//Date formatter
Date.prototype.yyyymmdd = function() {
  var yyyy = this.getFullYear().toString();
  var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
  var dd  = this.getDate().toString();
  return yyyy + "-" + (mm[1]?mm:"0"+mm[0]) + "-" + (dd[1]?dd:"0"+dd[0]); // padding
};

// Setting up other socket.io event handlers
socket.on('expiry_slots', function(data) {
  var date_obj = new Date();
  // Storing the expiry in local storage
  var slots = simpleStorage.get('expiry_slots');
  if (slots == undefined) {
    slots = data;
  } else {
    slots = slots.concat(data);
  }
  simpleStorage.set('expiry_slots', slots);
});

socket.on('bill_dispense_data', handleBillDispense);
socket.on('incoming_po', handleIncomingPO);

// This is only called from the home page
function readSocketEvents() {
  // Then, when in normal page,
  // first read off the keys populate data structures
  // read the bill_dispense data
  simpleStorage.index().map(function(key) {
    if (key.startsWith("bill_")) {
      var data = simpleStorage.get(key);
      showBillDispenseInDOM(data, key);
    }
  });

  var text = simpleStorage.get("stop_order_status");
  var targetDiv = $("#orders .panel_header .stop_order");
  if (text == 'Stop') {
    $(targetDiv).find("span").text("Start");
    $(targetDiv).find("img").attr("src", "img/icons/Delivered.png");
  } else {
    $(targetDiv).find("span").text("Stop");
    $(targetDiv).find("img").attr("src", "img/icons/Stop.png");
  }
}

function handleIncomingPO(data) {
  // data is a dictionary of rest_id - po_id and batch_id
  var counter = 0;
  if ($("#incoming-po-dialog").length == 0) {
    return;
  }

  // Filter out the POs which already have been accepted from the UI if any
  var existing = simpleStorage.get("incoming_po_tracker");
  var to_delete = false;
  if (existing) {
    for (var i = 0; i < data.length; i++) {
      to_delete = false;
      existing.map(function(item) {
        if (data[i]["po_id"] == item["po_id"] &&
            data[i]["batch_id"] == item["batch_id"] &&
            data[i]["r_id"] == item["rest_id"]) {
          // remove the item from the list
          to_delete = true;
        }
      });
      if (to_delete) {
        data.splice(i,1);
        i--;
      }
    }
  }

  $("#incoming-po-dialog .modal-body tbody").empty();

  // This will be a for loop of a list
  for (var i = 0; i < data.length; i++) {
    var date_obj = new Date(data[i]["scheduled_time"]);
    $("#incoming-po-dialog .modal-body tbody").append('<tr data-batch_id="'+data[i]["batch_id"]+'" data-rest_id="'+data[i]["r_id"]+'"><td><div class="radio radio-success"><label><input type="radio" name="po_options" value="'+data[i]["po_id"]+'" checked=""></label></div></td><td>'+data[i]["po_id"]+'</td><td>'+date_obj.toDateString()+' | '+date_obj.toLocaleTimeString()+'</td><td>'+data[i]["items"]+'</td><td>'+data[i]["qty"]+'</td><td>'+data[i]["rest_name"]+'</td></tr>');
    counter++;
  }
  $.material.init();
  $("#purchase_orders .incoming_pos .num").text(counter);
}

function handleBillDispense(data) {
  var date_obj = new Date();
  var tag = data["tag"];
  // Go through all the previous keys to see if a tag is already
  // present or not
  var isAlreadyPresent = false;
  simpleStorage.index().map(function(key) {
    if (key == "bill_" + tag) {
      isAlreadyPresent = true;
    }
  });
  if (isAlreadyPresent) {
    console.log("not doing anything as this is a duplicate");
    return;
  }
  var div_id = "bill_" + tag;
  // Storing the data for the pop up and later bill printing
  simpleStorage.set(div_id, data);

  if ($("#incoming-po-dialog").length == 0) {
    // Returning if this is not the home page
    return;
  }
  showBillDispenseInDOM(data, div_id);
}

function showBillDispenseInDOM(data, div_id) {
  counter_code = data["counter_code"];
  order_details = data["order_details"];
  var bill_no = data["bill_no"];
  var sides = data["sides"];
  var total_amount = 0;
  for (var item_id in order_details) {
    total_amount += order_details[item_id]["price"];
  }
  for (var item_id in sides) {
    total_amount += sides[item_id]["price"];
  }

  var rem = total_amount % 1000;
  var quot1k = parseInt(total_amount/1000);
  var IN1 = (quot1k + 1) * 1000;
  $("#left_pane > .cash_change tbody .change_1000").text('Change for '+ IN1 +' =' + (IN1-total_amount));

  if (rem < 500) {
    var IN2 = (quot1k * 1000) + 500;
    $("#left_pane > .cash_change tbody .change_500").text('Change for '+ IN2 +' =' + (IN2-total_amount));
  } else {
    $("#left_pane > .cash_change tbody .change_500").remove();
  }

  quot100 = parseInt(rem / 100);
  if (quot100 != 4 && quot100 != 9) {
    var IN3 = (quot1k * 1000) + ((quot100 + 1)* 100);
    $("#left_pane > .cash_change tbody .change_100").text('Change for '+ IN3 +' =' + (IN3-total_amount));
  } else {
    $("#left_pane > .cash_change tbody .change_100").remove();
  }

  $("#collect_cash").append('<div class="cash_notification">\
     Bill #'+bill_no+' collect INR '+ total_amount +' from counter '+counter_code+'  \
    <a id="'+div_id+'" href="javascript:void(0)" class="done btn btn-default btn-raised"> \
    <img src="img/icons/Delivered.png" /><span>Done</span></a></div>').append($("#left_pane > .cash_change").clone());
}

// Check if two dates are on same day.same
function isToday(datetime) {
  if(! datetime) {
    return false;
  }
  var d = new Date(datetime);
  var today = new Date();
  return (d.toDateString() == today.toDateString());
}

function getCustomDate(d) {
  var date_part = d.toDateString().substr(0,d.toDateString().length-5);
  var time_length = d.toLocaleTimeString().length;
  var am_pm = d.toLocaleTimeString().substr(time_length-2,time_length);
  var hr = d.toLocaleTimeString().split(':')[0];
  return date_part + ' | ' + hr + ' ' + am_pm;
}

function prettyPrintSlots(slots_array) {
  // Sorting the array
  slots_array =  slots_array.sort(function(a, b){return a-b});
  // Appending a sentinal element
  slots_array.push(9999);
  target_array = new Array();
  var numseq = 0;
  // Going through the array and coalescing consecutive elements
  for (var i = 0; i < slots_array.length-1; i++) {
    if (target_array[numseq] != undefined) {
      if (slots_array[i]+1 != slots_array[i+1]) {
        target_array[numseq] += "-" + slots_array[i].toString();
        numseq++;
      }
    } else {
      target_array[numseq] = slots_array[i].toString();
      if (slots_array[i]+1 != slots_array[i+1]) {
        numseq++;
      }
    }
  }
  console.log(target_array);
  return target_array;
}

function showItemExpiryPopup(item_id) {
  return confirm("Do you want to expire all of item_id- " + item_id + ' ?');
}

// This will return the prices and the veg/non-veg flag
function getItemDetails() {
  var jqxhr = $.getJSON(HQ_URL + '/food_item/price_info/' + OUTLET_ID)
    .done(function(data) {
      console.log('Received price data');
      for (var i = 0; i < data.length; i++) {
        price_data[data[i]["id"]] = {
          "mrp": data[i]["mrp"],
          "name": data[i]["name"],
          "item_tag": data[i]["item_tag"],
          "veg": data[i]["veg"],
          "service_tax_percent" : data[i]["service_tax_percent"],
          "vat_percent": data[i]["vat_percent"],
          "location": data[i]["location"],
          "side_order": data[i]["side_order"],
          "restaurant_details": { "id" : data[i]["r_id"],
                                  "name": data[i]["r_name"],
                                  "address" : data[i]["r_address"],
                                  "tin_no" : data[i]["r_tin_no"]},
          "coke_details" : {"id" : data[i]["b_id"],
                            "name" : data[i]["b_name"],
                            "mrp" : data[i]["b_mrp"],
                            "st" : data[i]["b_service_tax_percent"],
                            "vat" : data[i]["b_vat_percent"],
                            "discount_percent" : data[i]["discount_percent"],
                            "restaurant_details" :
                                { "id": data[i]["b_r_id"],
                                  "name": data[i]["b_r_name"],
                                  "address" : data[i]["b_r_address"],
                                  "tin_no" : data[i]["b_r_tin_no"]}
                            },
          "heating_reqd": data[i]["heating_required"],
          "stock_quantity": -1
        }
      }
      $.getJSON(OUTLET_URL + '/menu_display/stock_initial/')
      .done(function(data) {
        console.log("Received initial data ", data);
        stock_count = data;
        handleStockCount(data);
      })
      .fail(function(jqxhr, textStatus, error) {
        var err_msg = textStatus + ", " + error;
        console.error("Request Failed: " + err_msg);
      });
      // Setting up stock count event handler
    socket.on('stock_count', function (data) {
      console.log('Received stock data from socket.io- ' + JSON.stringify(data));
      stock_count = data;
      handleStockCount(data);
    });
    })
    .fail(function(jqxhr, textStatus, error) {
      var err_msg = textStatus + ", " + jqxhr.responseText;
      console.error("Request Failed: " + err_msg);
    });
}

function handleStockCount(stock_count) {
  for (var key in stock_count) {
    // Continuing if this is a bad item id
    if (!price_data.hasOwnProperty(key)) {
      continue;
    }
    var displayable_count = getStockItemCount(stock_count[key]["item_details"]) - stock_count[key]["locked_count"];
    price_data[key]["stock_quantity"] = displayable_count;
  }
}

function getIssueEnum() {
  var jqxhr = $.ajax({
    url: HQ_URL + '/food_item/issue_enum',
    success: function(data) {
      ISSUE_TYPES = (data.substr(1,data.length-2)).split(',');
      for (var i = 0; i < ISSUE_TYPES.length; i++) {
        ISSUE_TYPES[i] = ISSUE_TYPES[i].replace(/["]+/g, '');
      }
    },
    error: function(jqxhr, textStatus, error) {
      var err_msg = textStatus + ", " + jqxhr.responseText;
      console.error("Place order failed: " + err_msg);
    }
    });
}

function getStockItemCount(item_details) {
  var count = 0;
  for (var i = 0; i < item_details.length; i++) {
    if (!item_details[i]["expired"] && !item_details[i]["spoiled"]) {
      count += item_details[i]["count"];
    }
  }
  return count;
}

function getItemId(barcode) {
 return parseInt(barcode.substr(8, 4), 36);
}

