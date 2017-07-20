// Utility code to get the current month
var d = new Date();
var month = new Array();
month[0] = "January";
month[1] = "February";
month[2] = "March";
month[3] = "April";
month[4] = "May";
month[5] = "June";
month[6] = "July";
month[7] = "August";
month[8] = "September";
month[9] = "October";
month[10] = "November";
month[11] = "December";
var n_month = month[d.getMonth()];

var food_item_data = {};


$("#notifications").on("click", ".notification", function () {
    var category = $(this).find(".category").text();
    switch (category)
    {
        case "Cash":
            var key = $(this).attr("id");
            // Getting the order details from simple storage
            var val = simpleStorage.get(key);
            var counter_code = val["counter_code"];
            var order_details = val["order_details"];
            var mode = val["payment_mode"];
            var total_amount = 0;
            // populating the cash collection dialog
            $("#cash-collection-dialog .modal-body table tbody").empty();
            for (var item_id in order_details)
            {
                total_amount += order_details[item_id]["price"] * order_details[item_id]["count"];
                $("#cash-collection-dialog .modal-body table tbody").append("<tr><td>" + item_id + "</td><td>" + order_details[item_id]["name"] + "</td><td>" + order_details[item_id]["count"] + "</td></tr>");
            }
            $("#cash_collection_confirm").attr("data-key", key);
            $("#cash-collection-dialog .modal-header .counter_code").text(counter_code);
            $("#cash-collection-dialog .modal-header .total_amount").text(total_amount);
            $("#cash-collection-dialog").modal("show");
            break;
        case "Expiry":
            var slots = simpleStorage.get("expiry_slots");
            $("#expiry-items-dialog .modal-body .item_count").text(slots.length);
            $("#expiry-items-dialog .modal-body .slot_ids").text(slots);
            $("#expiry-items-dialog").modal("show");
            break;
        default:
            break;
    }
});

$("#collect_cash").on("click", ".cash_notification .done", function ()
{
    //  $(".cash_notification a").attr("disabled", "disabled");
    // Disabling the button
    $(this).css("pointer-events", "none");
    // Removing the cash change dialog
    $(this).parent().next().remove();
    // Send the data to LC to print bill and dispense item
    var key = $(this).attr("id");
    var val = simpleStorage.get(key);
    console.log("simpleStorage===--------------------:- ",JSON.stringify(val));
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/order_app/place_order',
        timeout: 5000,
        data: JSON.stringify({
            "order": val["order_details"],
            "sides": val["sides"],
            "bill_no": val["bill_no"],
            "counter_code": val["counter_code"],
            "mode": val["payment_mode"],
            "from_counter": true,
            "savings": val["savings"],
            "mobile_num": val["mobile_num"],
            "credit_card_no": val["credit_card_no"],
            "cardholder_name": val["cardholder_name"],
            "test_mode": false,
            "unique_Random_Id": val["unique_Random_Id"]
        }),
        success: function (data)
        {
            console.log(data);
            // Deleting the data from local storage
            simpleStorage.deleteKey(key);
            // Deleting the element from the page
            $("#" + key).parent().remove()
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            $(this).css("pointer-events", "auto");
            console.error("Place order failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#collect_cash").on("mouseover", ".cash_notification", function (event)
{
    $(this).next().show();
    $(this).next().css("top", $(this).position().top);
    $(this).next().css("left", $(this).position().left + $(this).width());
});

$("#collect_cash").on("mouseout", ".cash_notification", function (event)
{
    $(this).next().hide();
});


$("#expiry_items_confirm").click(function ()
{
    // Call the expiry items removal API
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/signal_expiry_item_removal',
        success: function (data)
        {
            console.log(data);
            // Remove all the expiry notifications
            $("#notifications .notification").each(function ()
            {
                var category = $(this).find(".category").text();
                if (category == "Expiry")
                {
                    $(this).remove();
                    return true;
                }
            });
            // Deleting the key and all its data
            simpleStorage.deleteKey("expiry_slots");
            // Hiding the dialog
            $("#expiry-items-dialog").modal("hide");
            // The flag from_load_items is there otherwise, the unscanned items
            // dialog would have opened if the expiry items dialog was directly opened
            if (from_load_items)
            {
                // after the unload unscanned items is clicked, an ajax call will get the data from redis
                // this will include the item ids and the batch_id and PO ids
                $.getJSON(OUTLET_URL + '/outlet_app/unscanned_slots')
                .done(function (data)
                {
                    var unscanned_slots_array = data["unscanned_slots"];
                    if (unscanned_slots_array != undefined)
                    {
                        unscanned_slots_array = prettyPrintSlots(unscanned_slots_array);
                        var unscanned_slots = '';
                        unscanned_slots_array.map(function (slot)
                        {
                            unscanned_slots += "<div class=\"unscanned_slot_item\">" + slot + "</div>";
                        });
                        $("#unscanned-items-dialog .modal-body .slot_ids").append(unscanned_slots);
                    }
                    if (from_eod)
                    {
                        $("#unscanned-items-dialog .modal-title").text("End of Day");
                        $("#unscanned-items-dialog .modal-header img").attr("src", "img/icons/End of Day.png");
                    } else {
                        $("#unscanned-items-dialog .modal-title").text("Expiry Popup");
                        $("#unscanned-items-dialog .modal-header img").attr("src", "img/icons/Load_black.png");
                    }
                    $("#unscanned-items-dialog").modal("show");
                    from_load_items = false;
                })
                .fail(function (jqxhr, textStatus, error)
                {
                    var err_msg = textStatus + ", " + jqxhr.responseText;
                    console.error("Request Failed: " + err_msg);
                });
            }
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Place order failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#unscanned_items_confirm").click(function ()
{
    // signalling the LC that unscanned items have been removed
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/update_unscanned_items',
        success: function (data)
        {
            console.log(data);
            // get the item ids for loading issue items and open the dialog
            $.getJSON(OUTLET_URL + '/outlet_app/get_loading_issue_items')
              .done(function (data)
              {
                  if (!Object.keys(data).length)
                  {
                      $("#unscanned-items-dialog").modal("hide");
                      return;
                  }
                  console.log("unscanned- ", data["unscanned"]);
                  console.log("loading- ", data["loading_issue"]);

                  last_batch_item_ids = data["loading_issue"];
                  var targetDiv = $("#loading-issue-dialog .modal-body .loading_issue_item_id_list table tbody");
                  $(targetDiv).empty();
                  // constructing the issue dropdown
                  var issuedropDown = '<select class="problem">';
                  ISSUE_TYPES.map(function (item)
                  {
                      issuedropDown += '<option>' + item + '</option>';
                  });
                  issuedropDown += '</select>';
                  var fooditemdropDown = '<select class="food_item">';
                  for (var i = 0; i < last_batch_item_ids.length; i++)
                  {
                      fooditemdropDown += '<option data-po_id="' + last_batch_item_ids[i]["purchase_order_id"] + '" data-batch_id="' + last_batch_item_ids[i]["batch_id"] + '" data-barcode="' + last_batch_item_ids[i]["barcode"] + '">' + last_batch_item_ids[i]["short_name"] + '-' + last_batch_item_ids[i]["item_id"] + '-' + last_batch_item_ids[i]["name"] + '</option>';
                  }
                  $(targetDiv).append('<tr class="item"><td>' + fooditemdropDown + '</td><td><input class="qty" type="text" /></td><td>' + issuedropDown + '</td><td><input class="note" type="text" /><img class="trash" src="img/icons/Trash.png" height="20"></td></tr>');

                  last_batch_item_ids = data["unscanned"];
                  var targetDiv = $("#loading-issue-dialog .modal-body .unscanned_item_id_list table tbody");
                  $(targetDiv).empty();
                  // constructing the issue dropdown
                  var issuedropDown = '<select class="problem">';
                  issuedropDown += '<option>unable to scan (Rest. fault)</option>';
                  issuedropDown += '<option>scanner fault (Foodbox fault)</option>';
                  issuedropDown += '</select>';
                  fooditemdropDown = '<select class="food_item">';
                  for (var i = 0; i < last_batch_item_ids.length; i++)
                  {
                      fooditemdropDown += '<option data-po_id="' + last_batch_item_ids[i]["purchase_order_id"] + '" data-batch_id="' + last_batch_item_ids[i]["batch_id"] + '" data-barcode="' + last_batch_item_ids[i]["barcode"] + '">' + last_batch_item_ids[i]["short_name"] + '-' + last_batch_item_ids[i]["item_id"] + '-' + last_batch_item_ids[i]["name"] + '</option>';
                  }
                  $(targetDiv).append('<tr class="item"><td>' + fooditemdropDown + '</td><td><input class="qty" type="text" /></td><td>' + issuedropDown + '</td><td><input class="note" type="text" /><img class="trash" src="img/icons/Trash.png" height="20"></td></tr>');

                  // then close the dialog
                  $("#unscanned-items-dialog").modal("hide");
                  if (from_eod)
                  {
                      $("#loading-issue-dialog .modal-title").text("End of Day");
                      $("#loading-issue-dialog .modal-header img").attr("src", "img/icons/End of Day.png");
                      // Removing the loading issue area because this is during end of day
                      $("#loading-issue-dialog .modal-body .loading_issue_item_id_list").empty();
                      $("#loading-issue-dialog .modal-body .loading_add_btn").remove();
                  } else
                  {
                      $("#loading-issue-dialog .modal-title").text("Load");
                      $("#loading-issue-dialog .modal-header img").attr("src", "img/icons/Load_black.png");
                  }
                  $("#loading-issue-dialog").modal("show");
              })
              .fail(function (jqxhr, textStatus, error)
              {
                  var err_msg = textStatus + ", " + jqxhr.responseText;
                  console.error("Request Failed: " + err_msg);
              });
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Update unscanned items failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#loading-issue-dialog .modal-body .loading_add_btn").click(function ()
{
    // cloning the row and then appending it to the table
    var clonedRow = $("#loading-issue-dialog .modal-body .loading_issue_item_id_list table tbody tr").last().clone();
    // Resetting text boxes to null
    $(clonedRow).find('input[type=text]').val("");
    var targetDiv = $("#loading-issue-dialog .modal-body .loading_issue_item_id_list table tbody");
    $(targetDiv).append(clonedRow);
});

$("#loading-issue-dialog .modal-body .unscanned_add_btn").click(function ()
{
    // cloning the row and then appending it to the table
    var clonedRow = $("#loading-issue-dialog .modal-body .unscanned_item_id_list table tbody tr").last().clone();
    // Resetting text boxes to null
    $(clonedRow).find('input[type=text]').val("");
    var targetDiv = $("#loading-issue-dialog .modal-body .unscanned_item_id_list table tbody");
    $(targetDiv).append(clonedRow);
});

$("#loading-issue-dialog .modal-body").on("click", ".trash", function ()
{
    // delete the current row
    $(this).parent().parent().remove();
});

$("#loading_issue_confirm").click(function ()
{
    // Disabling the button on click
    $("#loading_issue_confirm").prop("disabled", true);
    var item_id_list = [];
    $("#loading-issue-dialog .modal-body .loading_issue_item_id_list table tbody tr").each(function ()
    {
        var purchase_order_id = $(this).find(".food_item :selected").attr("data-po_id");
        var batch_id = $(this).find(".food_item :selected").attr("data-batch_id");
        var barcode = $(this).find(".food_item :selected").attr("data-barcode");
        var qty = $(this).find(".qty").val();
        if (qty == "")
        {
            return;
        }
        var problem = $(this).find(".problem").val();
        var note = $(this).find(".note").val();
        var item_id = $(this).children().first().children().val().split('-')[1];
        item_id_list.push({
            "batch_id": batch_id,
            "barcode": barcode,
            "purchase_order_id": purchase_order_id,
            "qty": qty, "item_id": item_id,
            "problem": problem, "note": note
        });
    });

    $("#loading-issue-dialog .modal-body .unscanned_item_id_list table tbody tr").each(function ()
    {
        var purchase_order_id = $(this).find(".food_item :selected").attr("data-po_id");
        var batch_id = $(this).find(".food_item :selected").attr("data-batch_id");
        var barcode = $(this).find(".food_item :selected").attr("data-barcode");
        var qty = $(this).find(".qty").val();
        if (qty == "")
        {
            return;
        }
        var problem = $(this).find(".problem").val();
        var note = $(this).find(".note").val();
        var item_id = $(this).children().first().children().val().split('-')[1];
        item_id_list.push({
            "batch_id": batch_id,
            "barcode": barcode,
            "purchase_order_id": purchase_order_id,
            "qty": qty, "item_id": item_id,
            "problem": problem, "note": note
        });
    });

    // Now push the item details to LC and from there to HQ
    // take the item id dict here. Basically the count of itemids
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/store_loading_issue_items',
        data: JSON.stringify({ "item_id_info": item_id_list }),
        success: function (data)
        {
            console.log(data);
            $("#loading_issue_confirm").prop("disabled", false);
            $("#loading-issue-dialog").modal("hide");
            if (from_eod)
            {
                from_eod = false;
                location.reload(true);
            }
        },
        error: function (jqxhr, textStatus, error)
        {
            $("#loading_issue_confirm").prop("disabled", false);
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Store loading issue items failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#purchase_orders .incoming_pos").click(function ()
{
    $("#incoming-po-dialog").modal("show");
});

$("#incoming-po-dialog .modal-footer .incoming_po_select").click(function ()
{
    // get the radio button item
    // get the rest_id, po and batch id
    var po_id = $("#incoming-po-dialog .modal-body input[type=radio]:checked").val();
    var batch_id = $("#incoming-po-dialog .modal-body input[type=radio]:checked").parents("tr").first().attr("data-batch_id");
    var rest_id = $("#incoming-po-dialog .modal-body input[type=radio]:checked").parents("tr").first().attr("data-rest_id");
    // and delete the row
    $("#incoming-po-dialog .modal-body input[type=radio]:checked").parents("tr").first().remove();

    // Add the removed combo to simpleStorage
    var existing = simpleStorage.get("incoming_po_tracker");
    if (!existing)
    {
        existing = [];
    }
    existing.push({
        po_id: po_id,
        batch_id: batch_id,
        rest_id: rest_id
    });
    simpleStorage.set("incoming_po_tracker", existing);

    // If no PO is selected, then directly return
    if (po_id == undefined)
    {
        $("#incoming-po-dialog").modal("hide");
        return;
    }

    // and store it in LC.
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/store_last_load_info',
        data: JSON.stringify({
            "po_id": po_id,
            "batch_id": batch_id,
            "rest_id": rest_id
        }),
        success: function (data)
        {
            console.log(data);
            // and decrease the counter
            $("#purchase_orders .incoming_pos .num").text(parseInt($("#purchase_orders .incoming_pos .num").text()) - 1);
            console.log($("#purchase_orders .incoming_pos .num").text());
            // and then close the dialog
            $("#incoming-po-dialog").modal("hide");
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Place order failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#eod_confirm").click(function ()
{
    // gather the data from the form and post it
    // on return, hide the dialog and reload the page
    var eod_supplies = {};
    $("#eod-dialog .modal-body table tbody tr").each(function ()
    {
        var item_id = $(this).attr("data-item_id");
        var count = $.trim($(this).find("input[type=text]").val());
        count = count === "" ? 0 : count;
        eod_supplies[item_id] = count;
    });

    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/end_of_day_signal',
        data: JSON.stringify({ "supplies": eod_supplies }),
        success: function (data)
        {
            console.log(data);
            // Hiding the dialog
            $("#eod-dialog").modal("hide");
            from_eod = true;
            // going into the load items workflow. i.e. the 3 screens.
            $("#load_items").trigger("click");
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Place order failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });

    // Triggering the stopping of orders
    $("#orders .panel_header .stop_order").trigger("click");
});

$("#sod_confirm").click(function ()
{
    // gather the data from the form and post it
    // on return hide the dialog
    var sod_supplies = {};
    $("#sod-dialog .modal-body table tbody tr").each(function ()
    {
        var item_id = $(this).attr("data-item_id");
        var count = $.trim($(this).find(".supply_qty").val());
        count = count === "" ? 0 : count;
        sod_supplies[item_id] = count;
    });

    simpleStorage.deleteKey("incoming_po_tracker");

    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/start_of_day_signal',
        data: JSON.stringify({ "supplies": sod_supplies }),
        success: function (data)
        {
            console.log(data);
            // Hiding the dialog
            $("#sod-dialog").modal("hide");
            // Showing the test mode dialog
            $("#test_mode-dialog").modal({ show: true, backdrop: "static" });
            simpleStorage.set("test_mode", true);
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Start of day signal failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });

    // Enabling orders from the order tab
    // Also checking if it has been stopped before, do it only then
    if ($("#orders .panel_header .stop_order").text() == "Start")
    {
        $("#orders .panel_header .stop_order").trigger("click");
    }
});

$("#test_mode-dialog .modal-footer #test_complete").click(function ()
{
    // Hiding the dialog
    $("#test_mode-dialog").modal("hide");
    simpleStorage.set("test_mode", false);
    // Stopping the test mode
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/test_mode',
        data: JSON.stringify({ "flag": false }),
        success: function (data)
        {
            console.log(data);
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Stopping test mode failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
    // Reloading the page, to prevent start_of_day to appear again
    location.reload(true);
});

$("#test_mode-dialog .modal-body #start_stage_1").click(function ()
{
    // Update modal DOM
    $("#test_mode-dialog .modal-body").attr("data-test-stage", "Stage 1");
    $("#test_mode-dialog .modal-body .test_stage").text("Test is at stage - 1");
    // Send the signal to LC
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/test_mode',
        data: JSON.stringify({ "flag": true }),
        success: function (data)
        {
            console.log(data);
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Starting test mode failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#test_mode-dialog .modal-body #start_stage_2").click(function ()
{
    // Update modal DOM
    $("#test_mode-dialog .modal-body").attr("data-test-stage", "Stage 2");
    $("#test_mode-dialog .modal-body .test_stage").text("Test is at stage - 2");
});

$("#test_mode-dialog .modal-body .report_issue button").click(function ()
{
    var issue_text = $("#test_mode-dialog .modal-body textarea").val();
    $("#test_mode-dialog .modal-body textarea").val("");
    if (!issue_text)
    {
        return false;
    }
    var stage = $("#test_mode-dialog .modal-body").attr("data-test-stage");
    issue_text = stage + " - " + issue_text;
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/test_mode_issue',
        data: JSON.stringify({ "text": issue_text }),
        success: function (data)
        {
            console.log(data);
            $("#test_mode-dialog .modal-body .report_issue").append('<div>' + data + '</div>');
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Reporting of test_issue failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#sales_cash .panel_header .spends").click(function ()
{
    // Resetting all the previous values to null
    $("#petty_cash-dialog .modal-body .amount").val("");
    $("#petty_cash-dialog .modal-body .note").val("");
    $("#petty_cash-dialog .modal-body .success_notification").remove();
    // Get the petty cash table
    $.getJSON(OUTLET_URL + '/outlet_app/petty_cash_breakdown')
      .done(function (data)
      {
          var targetDiv = $("#petty_cash-dialog .modal-body table tbody");
          $(targetDiv).empty();
          var totalAmount = 0;
          for (var i = 0; i < data.length; i++)
          {
              var amount = data[i]["amount"];
              var note = data[i]["note"];
              var date_obj = new Date(data[i]["time"]);
              $(targetDiv).append('<tr><td><img class="icons" src="img/icons/Rupee.png">' + amount + '</td><td>' + note + '</td><td>' + getCustomDate(date_obj) + '</td></tr>');
              totalAmount += amount;
          }
          // Update the total amount
          $("#petty_cash-dialog .modal-body .total_expenditure").text(totalAmount);
          // Show the dialog
          $("#petty_cash-dialog").modal("show");
      })
      .fail(function (jqxhr, textStatus, error)
      {
          var err_msg = textStatus + ", " + jqxhr.responseText;
          console.error("Request Failed: " + err_msg);
      });
});

$("#petty_cash-dialog .modal-footer .submit_petty_cash").click(function ()
{
    var amount = parseInt($("#petty_cash-dialog .modal-body .amount").val());
    var note = $("#petty_cash-dialog .modal-body .note").val();
    if (isNaN(parseInt($("#petty_cash-dialog .modal-body .amount").val())))
    {
        $("#petty_cash-dialog").modal("hide");
        return;
    }
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/petty_expenditure',
        data: JSON.stringify({ "data": { "amount": amount, "note": note } }),
        success: function (data)
        {
            console.log(data);
            $("#petty_cash-dialog .modal-body .enter_petty_cash").append('<div class="success_notification">' + data + '</div>');
            $("#petty_cash-dialog").modal("hide");
            getSalesData();
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Reporting of petty cash failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});


$("#load_items").click(function ()
{
    var slots = simpleStorage.get("expiry_slots");
    if (from_eod)
    {
        $("#expiry-items-dialog .modal-title").text("End of Day");
        $("#expiry-items-dialog .modal-header img").attr("src", "img/icons/End of Day.png");
    } else {
        $("#expiry-items-dialog .modal-title").text("Expiry Popup");
        $("#expiry-items-dialog .modal-header img").attr("src", "img/icons/Load_black.png");
    }
    if (slots)
    {
        slots = slots.map(Number).sort(function (a, b) { return a - b });
        // Making the slots unique
        var uniqueSlots = [];
        $.each(slots, function (i, el)
        {
            if ($.inArray(el, uniqueSlots) === -1) uniqueSlots.push(el);
        });
        $("#expiry-items-dialog .modal-body .item_count").text(uniqueSlots.length);
        $("#expiry-items-dialog .modal-body .slot_ids").text(uniqueSlots);
    } else
    {
        $("#expiry-items-dialog .modal-body .item_count").text('0');
        $("#expiry-items-dialog .modal-body .slot_ids").text('None');
    }
    from_load_items = true;
    $("#expiry-items-dialog").modal("show");
});

$("#load_scanned_items").click(function () {
    $("#scanned-items-dialog .modal-title").text("Scanned/Unscanned Items");
    $("#scanned-items-dialog .modal-header img").attr("src", "img/icons/Load_black.png");


    $.getJSON(OUTLET_URL + '/outlet_app/get_reconcile_stock_slots')
                    .done(function (data) {

                        var scanned_slots_html = show(data);

                        $("#scanned-items-dialog .modal-body .scanned_slots").html(scanned_slots_html);
                        // scanned_slots

                        $("#scanned-items-dialog").modal("show");
                    })
                    .fail(function (jqxhr, textStatus, error) {
                        var err_msg = textStatus + ", " + jqxhr.responseText;
                        console.error("Request Failed: " + err_msg);
                    });
});

$("#incoming-po-reconcile-modal .modal-footer .incoming_po_reconcile").click(function () {
    console.log("################################################### Reconcile confirm functionality called");
    if (confirm("Is data's correct. Do you want to proceed reconcile?")) {
        // Get reconcile data for all items and added in array variable



  async.waterfall([
    function (callback) {
        var reconcile_items = [];
        $("#incoming-po-reconcile-modal .modal-body tbody tr").each(function () {
            // var po_id = $($(this).children()[1]).text();
            var po_id = $(this).attr("data-po_id");
            var restaurant_id = $(this).attr("data-rest_id");
            var restaurant_name = $(this).attr("data-rest_name");
            var food_item_id = $(this).attr("data-food_item_id");
            var item_name = $(this).attr("data-item_name");
            var po_qty = $(this).attr("data-po-qty");
            var scanned_qty = $(this).attr("data-scanned-item-qty");
            var unscanned_qty = $('#' + food_item_id + "_TxtUnScanned").val();
            var damaged_qty = $('#' + food_item_id + "_TxtDamaged").val();
            // var damaged_scan_qty = $('#' + food_item_id + "_TxtDamagedScanFault").val();
            var undelivered_qty = $('#' + food_item_id + "_TxtUnDelivered").val();
            var expiry_qty = $('#' + food_item_id + "_TxtExpiry").val();
            var rest_fault_qty = $('#' + food_item_id + "_TxtRestFault").val();
            // var rest_scan_fault_ctrl = $('#' + food_item_id + "_TxtRestScanFault");
            var remarks = $('#' + food_item_id + "_DrpReconcileRemark option:selected").text();
            var valid_po_items_barcodes = $(this).attr("data-valid_po_item_barcodes");

            reconcile_items.push({
                po_id: po_id,
                restaurant_id: restaurant_id,
                restaurant_name: restaurant_name,
                food_item_id: food_item_id,
                item_name: item_name,
                po_qty: po_qty,
                scanned_qty: scanned_qty,
                unscanned_qty: unscanned_qty,
                damaged_qty: damaged_qty,
                // damaged_scan_qty: damaged_qty,
                expiry_qty: expiry_qty,
                rest_fault_qty: rest_fault_qty,
                remarks: remarks,
                // rest_scan_fault_ctrl: rest_scan_fault_ctrl,
                valid_po_items_barcodes: valid_po_items_barcodes                
            });

        });
        callback(null, reconcile_items);
    },
    function (reconcile_items, callback) {
        $.ajax({
            type: 'POST',
            url: OUTLET_URL + '/outlet_app/save_reconcile_data',
            data: JSON.stringify(reconcile_items),
            success: function (data) {
                callback(null, reconcile_items);
            },
            error: function (jqxhr, textStatus, error) {
                var err_msg = textStatus + ", " + jqxhr.responseText;
                console.error("save_reconcile_data failed: " + err_msg);
            },
            contentType: "application/json",
            dataType: 'text'
        });

    },
    function (reconcile_items, callback) {
        IncomingPOProcess(reconcile_items[0].po_id, reconcile_items[0].restaurant_id);
        callback(null, reconcile_items);
    },
    function (reconcile_items, callback) {        
        // undelivered item details mail send to respective restaurant
        send_restatrant_undelivered_po_mail(reconcile_items);
        reconcile_items = [];
        callback(null, 'done');
    }
        ], function (err, result) {
            if (err) {

            }
            if (result) {
                $("#incoming-po-reconcile-modal").modal("hide");
            }
        });

    }
});

$("#message_center .num_threads").click(function () {
    $("#message-threads-dialog").modal("show");
});

$("#message-comments-dialog .modal-header .back_to_threads").click(function ()
{
    $("#message-comments-dialog").modal("hide");
    $("#message-threads-dialog").modal("show");
});

$("#issues .panel_header .report_issues").click(function ()
{
    $.getJSON(OUTLET_URL + '/outlet_app/food_item_list')
      .done(function (data)
      {
          var food_item_list = data["food_item_list"];
          data["non_food_types"] = data["non_food_types"].replace(/"/g, '');
          var non_food_issue_types = (data["non_food_types"].substr(1, data["non_food_types"].length - 2)).split(',');

          // populating the non-food issues area
          $("#report-issues-dialog .modal-body #non_food_issue textarea").val("");
          targetDiv = $("#report-issues-dialog .modal-body #non_food_issue .category");
          $(targetDiv).empty();
          // creating the categories and subcategories first
          var non_food_categories = {};
          for (var i = 0; i < non_food_issue_types.length; i++)
          {
              var main_category = non_food_issue_types[i].split(':')[0];
              var sub_category = non_food_issue_types[i].split(':')[1];
              if (non_food_categories.hasOwnProperty(main_category))
              {
                  non_food_categories[main_category].push(sub_category);
              } else
              {
                  non_food_categories[main_category] = [sub_category];
              }
          }
          // Adding them to the dropdown
          for (var key in non_food_categories)
          {
              var text = '<optgroup label="' + key + '">';
              for (var i = 0; i < non_food_categories[key].length; i++)
              {
                  text += '<option>' + non_food_categories[key][i] + '</option>';
              }
              text += '</optgroup>';
              $(targetDiv).append(text);
          }
          $("#report-issues-dialog .modal-body #non_food_issue .reporter").empty();
          $("#staff-roster-dialog .togglebutton .username").each(function (item)
          {
              $("#report-issues-dialog .modal-body #non_food_issue .reporter").append('<option>' + $(this).text() + '</option>');
          });
          // Triggering the food btn click first so that the
          // proper tab is highlighted
          $("#report-issues-dialog").modal("show");
          $.material.init();
      })
      .fail(function (jqxhr, textStatus, error)
      {
          var err_msg = textStatus + ", " + jqxhr.responseText;
          console.error("Request Failed: " + err_msg);
      });
});

$("#report-issues-dialog .modal-footer .submit_report_issue").click(function ()
{
    var barcode_details = [];
    var no_barcode = false;

    var non_food_issue = {};
    var non_food_issue_subtype = $("#report-issues-dialog .modal-body #non_food_issue .category").val();
    var non_food_parent_category = $("#report-issues-dialog .modal-body #non_food_issue .category option:selected").parent().attr('label');
    if (non_food_issue_subtype != '')
    {
        non_food_issue["type"] = non_food_parent_category + ':' + non_food_issue_subtype;
        non_food_issue["note"] = $("#report-issues-dialog .modal-body #non_food_issue textarea").val();
    }
    non_food_issue["reporter"] = $("#report-issues-dialog .modal-body #non_food_issue .reporter").val();
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/update_item_issues',
        data: JSON.stringify({
            "barcode_details": barcode_details,
            "non_food_issue": non_food_issue
        }),
        success: function (data)
        {
            console.log(data);
            // Hiding the dialog
            $("#report-issues-dialog").modal("hide");
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Place order failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#report-issues-dialog .modal-body .food_btn").click(function ()
{
    // Updating the color
    $("#report-issues-dialog .modal-body .food_btn").css("background-color", "#CCCCCC");
    $("#report-issues-dialog .modal-body .non_food_btn").css("background-color", "white");
    $("#report-issues-dialog .modal-body .non_food_btn").css("border", "1px solid #CCCCCC");
    // Hiding/displaying the appropriate div
    $("#report-issues-dialog .modal-body #food_issue").show();
    $("#report-issues-dialog .modal-body #non_food_issue").hide();
});

$("#report-issues-dialog .modal-body .non_food_btn").click(function ()
{
    // Updating the color
    $("#report-issues-dialog .modal-body .non_food_btn").css("background-color", "#CCCCCC");
    $("#report-issues-dialog .modal-body .food_btn").css("background-color", "white");
    $("#report-issues-dialog .modal-body .food_btn").css("border", "1px solid #CCCCCC");
    // Hiding/displaying the appropriate div
    $("#report-issues-dialog .modal-body #non_food_issue").show();
    $("#report-issues-dialog .modal-body #food_issue").hide();
});

$("#staff_roster").click(function ()
{
    $("#staff-roster-dialog").modal("show");
});

$("#beverage_control").click(function ()
{
    $("#beverage-control-dialog").modal("show");
});

$("#force_failure").click(function ()
{
    $("#force-failure-dialog").modal("show");
});

$("#do_eod").click(function () {
    $.ajax({
        type: 'GET',
        url: OUTLET_URL + '/outlet_app/check_reconcile_data',
        success: function (data) {
            console.log("check_reconcile_data_url: " + JSON.parse(data));
            var result = JSON.parse(data);
            if (result.json_result.result_reconcile_data.length == 0) {
                // in the success callback, call getStaffRoster()
                if (confirm("This will expire all stock! Do you want to proceed?")) {
                    $.ajax({
                        type: 'POST',
                        url: OUTLET_URL + '/outlet_app/delete_reconcile_stock_count',
                        success: function (data) {
                        }
                        ,
                        error: function (jqxhr, textStatus, error) {
                            var err_msg = textStatus + ", " + jqxhr.responseText;
                            console.error("check_reconcile_data failed: " + err_msg);
                        },
                        contentType: "application/json",
                        dataType: 'text'
                    });
                    showEODDialog();
                }
            }
            else {
                alert("Can't produce EOD until to be complete reconcile for all PO's. So, please reconcile for all PO's");
            }
        },
        error: function (jqxhr, textStatus, error) {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("check_reconcile_data failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
});

$("#staff-roster-dialog .modal-footer .save_roster").click(function ()
{
    $("#staff-roster-dialog .modal-body .togglebutton").each(function (index)
    {
        // get current status
        var new_status = $(this).find('input[type=checkbox]').is(':checked') ? 'shift_start' : 'shift_end';
        var user_id = $(this).find('span.username').attr('data-id');
        // check with original status
        // if different, update the roster for that person
        if (new_status != staff_roster[user_id])
        {
            $.ajax({
                type: 'POST',
                url: OUTLET_URL + '/outlet_app/staff_roster',
                data: JSON.stringify({ "data": { "user_id": user_id, "shift": new_status } }),
                success: function (data)
                {
                    console.log(data);
                    // in the success callback, call getStaffRoster()
                    getStaffRoster();
                },
                error: function (jqxhr, textStatus, error)
                {
                    var err_msg = textStatus + ", " + jqxhr.responseText;
                    console.error("Place order failed: " + err_msg);
                },
                contentType: "application/json",
                dataType: 'text'
            });
        }
    });
    $("#staff-roster-dialog").modal("hide");
});

$("#beverage-control-dialog .modal-footer .update_beverages").click(function ()
{
    $("#beverage-control-dialog .modal-body .togglebutton").each(function (index)
    {
        // get current status
        var new_status = $(this).find('input[type=checkbox]').is(':checked');
        var item_id = $(this).find('span.beverage_item').attr('data-id');
        // update the new status in the dictionary
        beverage_data[item_id]["visible"] = new_status;
        simpleStorage.set(item_id + "_visibility", new_status);
    });
    // Posting the data to LC
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/beverage_control',
        data: JSON.stringify({ "data": beverage_data }),
        success: function (data)
        {
            console.log(data);
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Updating beverage control failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
    $("#beverage-control-dialog").modal("hide");
});

$("#force-failure-dialog .modal-footer .mark_failed").click(function ()
{
    var btn = $(this);
    btn.attr('disabled', 'disabled');
    var fail_all = $('#force-failure-dialog .modal-body .fail-all').prop('checked');
    console.log("Fail All PO: " + fail_all);
    // Posting the data to LC
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/force_fail_entire_stock',
        data: JSON.stringify({ "fail_all": fail_all }),
        success: function (data)
        {
            var allItems = [];
            $("#incoming-po-dialog .modal-body tbody tr").each(function ()
            {
                // get the radio button item
                // get the rest_id, po and batch id
                var po_id = $($(this).children()[1]).text();
                var batch_id = $(this).attr("data-batch_id");
                var rest_id = $(this).attr("data-rest_id");
                // and delete the row
                $(this).remove();

                // Add the removed combo to simpleStorage
                var existing = simpleStorage.get("incoming_po_tracker");
                if (!existing)
                {
                    existing = [];
                }
                allItems.push({
                    po_id: po_id,
                    batch_id: batch_id,
                    rest_id: rest_id
                })
                existing.push({
                    po_id: po_id,
                    batch_id: batch_id,
                    rest_id: rest_id
                });
                simpleStorage.set("incoming_po_tracker", existing);

                $("#purchase_orders .incoming_pos .num").text(parseInt($("#purchase_orders .incoming_pos .num").text()) - 1);
                console.log($("#purchase_orders .incoming_pos .num").text());
            });

            // and store it in LC.
            $.ajax({
                type: 'POST',
                url: OUTLET_URL + '/outlet_app/mark_po_received',
                data: JSON.stringify(allItems),
                success: function (data)
                {
                    console.log(data);
                },
                error: function (jqxhr, textStatus, error)
                {
                    var err_msg = textStatus + ", " + jqxhr.responseText;
                    console.error("Marking po received failed: " + err_msg);
                },
                contentType: "application/json",
                dataType: 'text'
            });

            console.log(data);
            btn.removeAttr('disabled');
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Manual failure of stocks failed: " + err_msg);
            btn.removeAttr('disabled');
        },
        contentType: "application/json",
        dataType: 'text'
    });
    $("#force-failure-dialog").modal("hide");
});

function checkStartOfDay()
{
    // check if outlet is not 24hr and start of day flag is enabled
    if (!is24hr && start_of_day)
    {
        var tableDiv = $("#sod-dialog .modal-body table tbody");
        $(tableDiv).empty();
        for (var i = 0; i < supply_list.length; i++)
        {
            $(tableDiv).append('<tr data-item_id="' + supply_list[i].id + '"><td><img src="' + supply_list[i].image_url + '" height="30">' + supply_list[i].name + '</td><td><input type="number" class="supply_qty" max="10000" onKeyUp="if (this.value.length > 5) { this.value = this.value.substring(0, 5);} "/></td></tr>');
        }
        $("#sod-dialog").modal({ show: true, backdrop: "static" });
    }
}

$("#orders .panel_header .stop_order").click(function ()
{
    // get the current text , and send the message to the LC
    var text = $(this).find("span").text();
    // toggle the button text
    if (text == 'Stop')
    {
        $(this).find("span").text("Start");
        $(this).find("img").attr("src", "img/icons/Delivered.png");
        sendStopOrder();
    } else
    {
        $(this).find("span").text("Stop");
        $(this).find("img").attr("src", "img/icons/Stop.png");
        sendStartOrder();
    }
    simpleStorage.set("stop_order_status", text);
});

function sendStopOrder()
{
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/stop_orders',
        success: function (data)
        {
            console.log(data);
        },
        error: function (jqxhr, textStatus, error)
        {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Send stop orders failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
}

function sendStartOrder() {
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/resume_orders',
        success: function (data) {
            console.log(data);
        },
        error: function (jqxhr, textStatus, error) {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Send resume orders failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });

}

function show(data) {
    // console.log("food_item_data********************************************: " + JSON.stringify(food_item_data));
    // slot details
    var scanned_min_value = data["scanned_min_value"];
    var scanned_max_value = data["scanned_max_value"];
    var scanned_slots_array = data["scanned_slots"];
    var empty_slots_array = data["empty_slots"];
    var dispenser_slot_count = data["dispenser_slot_count"];
    var item_id_slot_wise = data["item_id_slot_wise"];
 var scanned_count = 0;
    var slot_style = "slot_popup slot_bg_empty";
    var htmlCode = "<table border='1'  width='100%'>";
    var slot_row_count = Number(dispenser_slot_count) / 5;
    //var stRow = c * 30; //30  60
    //var endRow = stRow - 29; //30-29=1 60-29=31    

    for (i = slot_row_count; i >= 1; i--) {
        htmlCode = htmlCode + "<tr >";
        var col = i;
        for (var c = 1; c <= 5; c++) {
            slot_style = "slot_popup slot_bg_empty";
            // check the slot id within the scanned slots
            if (col >= Number(scanned_min_value) && col <= Number(scanned_max_value)) {
                slot_style = "slot_popup slot_bg_scanned";
           
            }

            // check the slot id with in the scanned min an max values but not in scanned slots
            if (col >= Number(scanned_min_value) && col <= Number(scanned_max_value) && scanned_slots_array.indexOf(col) == -1) {
                slot_style = "slot_popup slot_bg_un_scanned";
            }

            var slot_item_name = GetSlotItemName(col, item_id_slot_wise);

            if (slot_item_name != "") {
                htmlCode += "<td id=" + col + " class='" + slot_style + "' >" + col + ": " + slot_item_name + "</td>";
            }
            else {
                htmlCode += "<td id=" + col + " class='" + slot_style + "' >" + col + "</td>";
            }

            col = col + Number(slot_row_count);
        }

        htmlCode = htmlCode + "</tr>";
    }


    htmlCode = htmlCode + "</table>"


    ////document.getElementById("htmlcodex").innerHTML(htmlCode);
    ////alert(htmlCode);
    ////$('htmlcodex').val('htmlCode');
    ////alert(document.getElementById("htmlcodex"));

    //document.getElementById("htmlcodex").innerHTML = htmlCode;

    return htmlCode;
}

function GetSlotItemName(slot_id, item_id_slot_wise) {
    for (var i = 0 ; i < item_id_slot_wise.items.length; i++) {
        if (item_id_slot_wise.items[i].slot_ids.indexOf(slot_id) != -1) {
            var item_id = item_id_slot_wise.items[i].item_id;
            if (food_item_data[item_id] != null) {
                return food_item_data[item_id].name;
            }

            return "";
        }
    }
    return "";
}

var scanned_item_barcodes = function (po_details, reconcile_redis_stock, callback) {
    try {
        var item_barcodes = [];
        var scanned_item_count = 0;
        var valid_po_item_barcodes = [];
        if (po_details.barcodes != null) {
            // return callback(null, item_barcodes = barcodes.split(","));
            item_barcodes = po_details.barcodes.split(",")
            var count = 0;
            var isexist = false;
            var barcode_time = [];
            if (reconcile_redis_stock != null) {
                for (var item = 0; item < reconcile_redis_stock.length; item++) {
                    count++;
                    if (reconcile_redis_stock[item] != null) {
                        isexist = false;
                        if (Number(po_details.food_item_id) == Number(reconcile_redis_stock[item].item_id))
                            // && barcode_time >= session_start_time && barcode_time <= session_end_time)
                        {
                            for (var i = 0; i < item_barcodes.length; i++) {

                                // Get packaging time from barcode
                                barcode_time.push(item_barcodes[i].slice(-4).splice(2, 0, ":"));


                                var reconcile_barcode = reconcile_redis_stock[item].barcode;
                                // Check packaging barcode with redis barcode
                                if (item_barcodes[i] == reconcile_barcode) {
                                    valid_po_item_barcodes.push(reconcile_redis_stock[item].barcode);
                                    // Get item count for that barcode
                                    scanned_item_count += reconcile_redis_stock[item].count
                                    isexist = true;
                                    //break;
                                    //if (scanned_item_count != 0)
                                    //{ is_scanned = true; }
                                }
                            }

                            if (!isexist) {

                                barcode_time.sort(function (a, b) {
                                    return new Date('1970/01/01 ' + a) - new Date('1970/01/01 ' + b);
                                });

                                var barcode_min_time = barcode_time[0];
                                var barcode_max_time = barcode_time[barcode_time.length - 1];

                                var d = new Date('1970/01/01 ' + barcode_min_time);
                                d.setMinutes(d.getMinutes() - 30);

                                var mx = new Date('1970/01/01 ' + barcode_max_time);
                                mx.setMinutes(mx.getMinutes() + 30);

                                var redis_barcode_time = reconcile_redis_stock[item].barcode.slice(-4).splice(2, 0, ":");
                                var newdt = new Date('1970/01/01 ' + redis_barcode_time);

                                if (newdt.getTime() < mx.getTime() && newdt.getTime() > d.getTime()) {
                                    valid_po_item_barcodes.push(reconcile_redis_stock[item].barcode);
                                    scanned_item_count += reconcile_redis_stock[item].count
                                }
                            }
                        }
                    }

                    if (count == reconcile_redis_stock.length) {
                        return callback(null, scanned_item_count, valid_po_item_barcodes, po_details)
                    }
                    // is_transporter_pickup = true;
                }
            }

            //for (var i = 0; i < item_barcodes.length; i++) {
            //    count++;
            //    if (reconcile_redis_stock != null) {
            //        for (var item = 0; item < reconcile_redis_stock.length; item++) {
            //            if (reconcile_redis_stock[item] != null) {
            //                // Get packaging time from barcode
            //                // var barcode_time = reconcile_redis_stock[item].barcode.slice(-4).splice(2, 0, ":");

            //                // Check barcode time with session start_time and end_time
            //                if (po_details.food_item_id == reconcile_redis_stock[item].item_id)
            //                    // && barcode_time >= session_start_time && barcode_time <= session_end_time)
            //                {
            //                    var reconcile_barcode = reconcile_redis_stock[item].barcode;
            //                    if (item_barcodes[i] == reconcile_barcode) {
            //                        valid_po_item_barcodes.push(reconcile_redis_stock[item].barcode);
            //                        // Get item count for that barcode
            //                        scanned_item_count += reconcile_redis_stock[item].count
            //                        //if (scanned_item_count != 0)
            //                        //{ is_scanned = true; }
            //                    }
            //                }
            //            }
            //        }
            //        if (count == item_barcodes.length) {
            //            return callback(null, scanned_item_count, valid_po_item_barcodes, po_details)
            //            // is_transporter_pickup = true;
            //        }
            //    }
            //}
        }
        else {
            // Get packaging barcodes from firebase (if transporter pickup not done)         
            // '/{}/{}/{}'.format(restaurant_id, po_id, food_item_id)
            //var rootref = new Firebase("https://atp-fv-tracker.firebaseio.com");
            //var rootref = new Firebase("https://owltech-hq.firebaseio.com");

            var rootref = new Firebase(po_details.firebase_url);
            
            var fv_url = "/" + po_details.restaurant_id + "/" + po_details.id + "/" + po_details.food_item_id + "/barcodes";
            var stock_count_node = rootref.child(fv_url);
            // var stock_count_node = rootref.child("/" + OUTLET_ID + "/" + "/" + po_id + "/" + po_details[item_count].food_item_id, "barcodes");
            // Getting the stock data
            stock_count_node.once("value", function (data) {
                var data = data.val();

                var val = {};
                for (var key in data) {
                    if (val.hasOwnProperty(data[key])) {
                        val[data[key]]++;
                    } else {
                        val[data[key]] = 1;
                    }
                }
                for (var i in val) {
                    item_barcodes.push(i)
                }

                var count = 0;
                var isexist = false;
                var barcode_time = [];
                if (reconcile_redis_stock != null) {
                    for (var item = 0; item < reconcile_redis_stock.length; item++) {
                        count++;
                        if (reconcile_redis_stock[item] != null) {
                            isexist = false;
                            if (Number(po_details.food_item_id) == Number(reconcile_redis_stock[item].item_id))
                                // && barcode_time >= session_start_time && barcode_time <= session_end_time)
                            {
                                for (var i = 0; i < item_barcodes.length; i++) {

                                    // Get packaging time from barcode
                                    barcode_time.push(item_barcodes[i].slice(-4).splice(2, 0, ":"));


                                    var reconcile_barcode = reconcile_redis_stock[item].barcode;
                                    // Check packaging barcode with redis barcode
                                    if (item_barcodes[i] == reconcile_barcode) {
                                        valid_po_item_barcodes.push(reconcile_redis_stock[item].barcode);
                                        // Get item count for that barcode
                                        scanned_item_count += reconcile_redis_stock[item].count
                                        isexist = true;
                                        //break;
                                        //if (scanned_item_count != 0)
                                        //{ is_scanned = true; }
                                    }
                                }

                                if (!isexist) {

                                    barcode_time.sort(function (a, b) {
                                        return new Date('1970/01/01 ' + a) - new Date('1970/01/01 ' + b);
                                    });

                                    var barcode_min_time = barcode_time[0];
                                    var barcode_max_time = barcode_time[barcode_time.length - 1];

                                    var d = new Date('1970/01/01 ' + barcode_min_time);
                                    d.setMinutes(d.getMinutes() - 30);

                                    var mx = new Date('1970/01/01 ' + barcode_max_time);
                                    mx.setMinutes(mx.getMinutes() + 30);

                                    var redis_barcode_time = reconcile_redis_stock[item].barcode.slice(-4).splice(2, 0, ":");
                                    var newdt = new Date('1970/01/01 ' + redis_barcode_time);

                                    if (newdt.getTime() < mx.getTime() && newdt.getTime() > d.getTime()) {
                                        valid_po_item_barcodes.push(reconcile_redis_stock[item].barcode);
                                        scanned_item_count += reconcile_redis_stock[item].count
                                    }
                                }
                            }
                        }

                        if (count == reconcile_redis_stock.length) {
                            return callback(null, scanned_item_count, valid_po_item_barcodes, po_details)
                        }
                        // is_transporter_pickup = true;
                    }
                }
            });
        }

    } catch (ex) {
        return callback(ex);
    }
}

function Reconcile(btn_reconcile, po_id, total_item_count, total_quantity) {
    // ,total_item_count,total_quantity,restaurant_name
    console.log(" PO_ID: " + po_id + " Item Count: " + total_item_count + " Quantity: " + total_quantity);
    var restaurant_name = $(btn_reconcile).attr("data-rest_name");
    var text = '';
    var non_food_categories = {};
    $('.signal').show();
    $.getJSON(OUTLET_URL + '/outlet_app/reconcile_remarks')
     .done(function (data) {
         var reconcile_remarks = (data["reconcile_remarks"].substr(1, data["reconcile_remarks"].length - 2)).split(',');


         // Get PO details
         $.ajax({
             type: 'GET',
             url: OUTLET_URL + '/outlet_app/get_po_details/' + po_id,
             success: function (data) {
                 $('.signal').hide()
                 var json_data = JSON.parse(data);

                 var po_details = json_data.json_result.po_details;
                 var reconcile_redis_stock = json_data.reconcile_stock_count;
                 var is_transporter_pickup = false;
                 var is_scanned = false;
                 var is_transporter_pickup_msg = false;
                 var is_scanned_msg = false;
                 var is_exceeds_quantity_msg = false;

                 // var po_item_ids = po_details.map(function (a) { return a.food_item_id; });
                 // console.log("po_item_ids: " + po_item_ids);

                 $("#incoming-po-reconcile-modal .modal-body tbody").empty();

                 var title = "PO No: " + po_id + "-" + restaurant_name;
                 $("#incoming-po-reconcile-modal .modal-title").text(title);

                 for (var item_count = 0; item_count < po_details.length; item_count++) {

                     scanned_item_barcodes(po_details[item_count], reconcile_redis_stock, function (err, scanned_item_count, valid_po_item_barcodes, po_details) {
                         if (err) {
                             console.log("scanned_item_barcodes Error: " + err);
                         }

                         var disable_textbox = "";
                         var disable_undelivered_textbox = "Readonly=true";
                         var disable_scanned_textbox = "Readonly=true";
                         var disable_damaged_textbox = "";
                         var disable_expiry_textbox = "Readonly=true";
                         var po_scheduled_time = po_details.po_time;
                         
                          var session_start_time = po_details.start_time;
                         var session_end_time = po_details.end_time;
                         var expiry_time_intervar = Number(EXPIRY_TIME_INTERVAL);

                         var max_time_expiry_edit = new Date('1970/01/01 ' + session_end_time);
                         max_time_expiry_edit.setMinutes(max_time_expiry_edit.getMinutes() - expiry_time_intervar);

                         var time = timeNow();
                         var current_time = new Date('1970/01/01 ' + time);

                         if (current_time.getTime() > max_time_expiry_edit.getTime()) {
                             disable_expiry_textbox = "";
                         }                         

                         // if (scanned_item_count) {

                             // TODO - please remove commaded code when going to production - Transporter pick up done and also not scanned in dispenser
                            // if (!is_transporter_pickup_msg && scanned_item_count == 0 && !is_scanned) {
                              //   if (!is_scanned_msg) {
                                //     alert("Scanned not done in dispenser. so, please scan the items from " + po_details.restaurant_name);
                               //  }

                                // is_scanned_msg = true;
                                // return false;
                            // }

                             //console.log("item_count: " + po_details.food_item_id + " :" + scanned_item_count);

                             var undelivered_qty = Number(po_details.quantity) - Number(scanned_item_count);

                             if (scanned_item_count >= po_details.quantity) {
                                 disable_textbox = "Readonly=true";
                                 disable_damaged_textbox = "Readonly=true";
                                 disable_expiry_textbox = "Readonly=true";
                             }

                             if (scanned_item_count > po_details.quantity) {
                                 // scanned_item_count = po_details.quantity;
                                 undelivered_qty = 0;
                                 if (!is_exceeds_quantity_msg) {
                                     alert("Received quantity exceeds than the PO quantity for " + po_details.restaurant_name);
                                 }

                                 is_exceeds_quantity_msg = true;
                             }
                                                        

                             var str_reconcile_data = '';
                             str_reconcile_data += '<tr data-po_id="' + po_details.id + '" data-rest_id="' + po_details.restaurant_id + '" data-food_item_id="' + po_details.food_item_id + '" data-rest_name="' + po_details.restaurant_name + '" data-item_name="' + po_details.item_name + '" data-po-qty="' + po_details.quantity + '" data-scanned-item-qty="' + scanned_item_count + '" data-valid_po_item_barcodes="' + valid_po_item_barcodes + '">';
                             // str_reconcile_data += '<td>' + po_detailpo_details.s.food_item_id + po_details.'</td>';
                             str_reconcile_data += '<td width="20%">' + po_details.item_tag + '</td>';
                             str_reconcile_data += '<td width="20%">' + po_details.master_id + '</td>';
                             str_reconcile_data += '<td width="20%">' + po_details.item_name + '</td>';
                             str_reconcile_data += '<td width="20%">' + po_details.quantity + '</td>';
                             str_reconcile_data += '<td> <input type="text" class="numeric" id="' + po_details.food_item_id + "_TxtScanned" + '" name="' + po_details.food_item_id + "_TxtScanned" + '" value=" ' + scanned_item_count + ' " ' + disable_scanned_textbox + ' onkeyup="CheckPOQuantity(' + po_details.food_item_id + ' ,' + po_details.quantity + ', ' + scanned_item_count + ',this, ' + is_transporter_pickup + ');"  maxlength="5" style="width:50px"/></td>';
                             str_reconcile_data += '<td> <input type="text" class="numeric"  id="' + po_details.food_item_id + "_TxtUnScanned" + '" name="' + po_details.food_item_id + "_TxtUnScanned" + '" value=" " maxlength="5" style="width:50px" ' + disable_textbox + ' onkeyup="CheckPOQuantity(' + po_details.food_item_id + ' ,' + po_details.quantity + ', ' + scanned_item_count + ',this, ' + is_transporter_pickup + ');" /></td>';
                             str_reconcile_data += '<td> <input type="text" class="numeric" id="' + po_details.food_item_id + "_TxtDamaged" + '" name="' + po_details.food_item_id + "_TxtDamaged" + '" value=" " maxlength="5" style="width:50px" ' + disable_damaged_textbox + ' onkeyup="CheckPOQuantity(' + po_details.food_item_id + ' ,' + po_details.quantity + ', ' + scanned_item_count + ',this, ' + is_transporter_pickup + ');"/></td>';
                             // str_reconcile_data += '<td> <input type="text" class="numeric" id="' + po_details.food_item_id + "_TxtDamagedScanFault" + '" name="' + po_details.food_item_id + "_TxtDamagedScanFault" + '" value="" maxlength="5" style="width:50px"  ' + disable_textbox + ' onkeyup="CheckPOQuantity(' + po_details.food_item_id + ' ,' + po_details.quantity + ', ' + scanned_item_count + ',this, ' + is_transporter_pickup + ');"/></td>';
                             str_reconcile_data += '<td> <input type="text" class="numeric" id="' + po_details.food_item_id + "_TxtExpiry" + '" name="' + po_details.food_item_id + "_TxtExpiry" + '" value="" maxlength="5" style="width:50px"  ' + disable_expiry_textbox + ' onkeyup="CheckPOQuantity(' + po_details.food_item_id + ' ,' + po_details.quantity + ', ' + scanned_item_count + ',this, ' + is_transporter_pickup + ');"/></td>';
                             str_reconcile_data += '<td> <input type="text" class="numeric" id="' + po_details.food_item_id + "_TxtUnDelivered" + '" name="' + po_details.food_item_id + "_TxtUnDelivered" + '" value=" ' + undelivered_qty + ' " ' + disable_undelivered_textbox + ' onkeyup="CheckPOQuantity(' + po_details.food_item_id + ' ,' + po_details.quantity + ', ' + scanned_item_count + ',this, ' + is_transporter_pickup + ');"  maxlength="5" style="width:50px"/></td>';
                             str_reconcile_data += '<td> <input type="text" class="numeric" id="' + po_details.food_item_id + "_TxtRestFault" + '" name="' + po_details.food_item_id + "_TxtRestFault" + '" value="" maxlength="5" style="width:50px"  ' + disable_textbox + ' onkeyup="CheckPOQuantity(' + po_details.food_item_id + ' ,' + po_details.quantity + ', ' + scanned_item_count + ',this, ' + is_transporter_pickup + ');"/></td>';
                             // str_reconcile_data += '<td> <input type="text" class="numeric" id="' + po_details.food_item_id + "_TxtRestScanFault" + '" name="' + po_details.food_item_id + "_TxtRestScanFault" + '" value="" maxlength="5" style="width:50px"  ' + disable_textbox + ' onkeyup="CheckPOQuantity(' + po_details.food_item_id + ' ,' + po_details.quantity + ', ' + scanned_item_count + ',this, ' + is_transporter_pickup + ');"/></td>';
                             // str_reconcile_data += '<td><div id="' + po_details.food_item_id + '_DrpRemarks"></div></td>';

                             // Adding them to the dropdown
                             text = '<select id=' + po_details.food_item_id + '_DrpReconcileRemark>';
                             for (var i = 0; i < reconcile_remarks.length; i++) {
                                 text += '<option >' + reconcile_remarks[i] + '</option>';
                             }
                             text += '</select>';
                             // $(po_details.food_item_id + '_DrpRemarks').append(text);
                             str_reconcile_data += '<td>' + text + '</td>';

                             // str_reconcile_data += '<td> <input type="text" id="' + po_details.food_item_id + "_TxtRemarks" + '" name="' + po_details.food_item_id + "_TxtRemarks" + '" value="" maxlength="1000" style="width:150px"/></td>';
                             //str_reconcile_data += '<td>' + data[i]["rest_name"] + '</td>';
                             //str_reconcile_data += "<td> <button id=" + data[i]["po_id"] + "_reconcile class='incoming_po_reconcile btn btn-raised btn-default' onclick='Reconcile(this," + data[i]["po_id"] + "," + data[i]["items"] + "," + data[i]["qty"] + ")' style=padding:5px>Reconcile</button></td>";
                             str_reconcile_data += '</tr>';

                             $("#incoming-po-reconcile-modal .modal-body tbody").append(str_reconcile_data);


                        // }
                     });
                 }

                 $("#incoming-po-reconcile-modal").modal("show");

             },
             error: function (jqxhr, textStatus, error) {
                 $('.signal').hide()
                 var err_msg = textStatus + ", " + jqxhr.responseText;
                 console.error("Store loading issue items failed: " + err_msg);
             },
             contentType: "application/json",
             dataType: 'text'
         });
     })
     .fail(function (jqxhr, textStatus, error) {
         $('.signal').hide()
         var err_msg = textStatus + ", " + jqxhr.responseText;
         console.error("Request Failed: " + err_msg);
     });
}

function CheckPOQuantity(food_item_id, po_qty, scanned_qty, current_textbox, is_transporter_pickup) {
    // scanned_textbox,unscanned_textbox,po_qty,scanned_qty
    var unscanned_ctrl = $('#' + food_item_id + "_TxtUnScanned");
    var damaged_ctrl = $('#' + food_item_id + "_TxtDamaged");
    var undelivered_ctrl = $('#' + food_item_id + "_TxtUnDelivered");
    var scanned_ctrl = $('#' + food_item_id + "_TxtScanned");
    var expiry_ctrl = $('#' + food_item_id + "_TxtExpiry");
    var rest_fault_ctrl = $('#' + food_item_id + "_TxtRestFault");
    // var rest_scan_fault_ctrl = $('#' + food_item_id + "_TxtRestScanFault");
    // var damaged_scan_ctrl = $('#' + food_item_id + "_TxtDamagedScanFault");
    var actual_scanned_qty = scanned_qty;

    var total_process_qty = 0;
    var undelivered_qty = 0;
    // total_process_qty = Number(unscanned_ctrl.val()) + Number(damaged_ctrl.val()) + Number(rest_fault_ctrl.val()) + Number(rest_scan_fault_ctrl.val()) + Number(damaged_scan_ctrl.val());
    total_process_qty = Number(unscanned_ctrl.val()) + Number(damaged_ctrl.val()) + Number(rest_fault_ctrl.val()) + Number(expiry_ctrl.val());
        
    //if (Number(rest_scan_fault_ctrl.val()) > 0 || Number(damaged_scan_ctrl.val()) > 0) {
    //    scanned_qty -= (Number(rest_scan_fault_ctrl.val()) + Number(damaged_scan_ctrl.val()));
    //    scanned_ctrl.val(scanned_qty);
    //}
    //else {
    //    scanned_ctrl.val(actual_scanned_qty);

    //}

    scanned_ctrl.val(scanned_qty);

    total_process_qty += Number(scanned_qty);

    if (total_process_qty > Number(po_qty) || Number(scanned_qty) > total_process_qty) {
        total_process_qty -= Number($(current_textbox).val());
        $(current_textbox).val("");
        // // // total_process_qty = Number(scanned_qty) + Number(unscanned_ctrl.val()) + Number(damaged_ctrl.val());
        // undelivered_ctrl.val(0);
        //undelivered_qty = Number(po_qty) - Number(total_process_qty);
    }
    //else {
    //    undelivered_qty = Number(po_qty) - Number(total_process_qty);
    //}

    undelivered_qty = Number(po_qty) - Number(total_process_qty);
    undelivered_ctrl.val(undelivered_qty);
    
    ////}
    ////else // if transporter pickup not done, we calculate scanned quantity (based on undelivered, unscanned and damaged)
    ////{
    ////    //total_process_qty = Number(undelivered_ctrl.val()) + Number(unscanned_ctrl.val()) + Number(damaged_ctrl.val());
    ////    total_process_qty += Number(undelivered_ctrl.val());

    ////    if (total_process_qty > Number(po_qty)) {
    ////        total_process_qty -= Number($(current_textbox).val());
    ////        $(current_textbox).val("");
    ////        //total_process_qty = Number(undelivered_ctrl.val()) + Number(unscanned_ctrl.val()) + Number(damaged_ctrl.val());
    ////    }

    ////    var scanned_quantity = Number(po_qty) - Number(total_process_qty);
    ////    scanned_ctrl.val(scanned_quantity);
    ////}
}

function IncomingPOProcess(purchase_order_id, restaurant_id) {
    // get the radio button item
    // get the rest_id, po and batch id
    //var po_id = $("#incoming-po-dialog .modal-body input[type=radio]:checked").val();
    //var batch_id = $("#incoming-po-dialog .modal-body input[type=radio]:checked").parents("tr").first().attr("data-batch_id");
    //var rest_id = $("#incoming-po-dialog .modal-body input[type=radio]:checked").parents("tr").first().attr("data-rest_id");
    //// and delete the row
    //$("#incoming-po-dialog .modal-body input[type=radio]:checked").parents("tr").first().remove();

    var po_id = purchase_order_id;
    var batch_id = '';
    var rest_id = restaurant_id;
    // Add the removed combo to simpleStorage
    var existing = simpleStorage.get("incoming_po_tracker");
    if (!existing) {
        existing = [];
    }
    existing.push({
        po_id: po_id,
        batch_id: batch_id,
        rest_id: rest_id
    });
    simpleStorage.set("incoming_po_tracker", existing);

    // If no PO is selected, then directly return
    if (po_id == undefined) {
        $("#incoming-po-dialog").modal("hide");
        return;
    }

    // and store it in LC.
    $.ajax({
        type: 'POST',
        url: OUTLET_URL + '/outlet_app/store_last_load_info',
        data: JSON.stringify({
            "po_id": po_id,
            "batch_id": batch_id,
            "rest_id": rest_id
        }),
        success: function (data) {
            console.log(data);
            // and decrease the counter
            $("#purchase_orders .incoming_pos .num").text(parseInt($("#purchase_orders .incoming_pos .num").text()) - 1);
            console.log($("#purchase_orders .incoming_pos .num").text());
            // and then close the dialog
            $("#incoming-po-dialog").modal("hide");
        },
        error: function (jqxhr, textStatus, error) {
            var err_msg = textStatus + ", " + jqxhr.responseText;
            console.error("Place order failed: " + err_msg);
        },
        contentType: "application/json",
        dataType: 'text'
    });
}

function send_restatrant_undelivered_po_mail(items) {
    console.log("####################################################### send_restatrant_undelivered_po_mail items==========" + JSON.stringify(items));
    var mail_response = "";
    var excess_mail_response = "";
    var mail_message_count = 0;
    var total_undelivered_qty = 0;
    var total_excess_qty = 0;

    async.waterfall([
    function (callback) {
        for (var item in items) {
            console.log("started send_restatrant_undelivered_po_mail===" + JSON.stringify(items[item]));
            var delivered_qty = Number(items[item].scanned_qty) + Number(items[item].unscanned_qty) + Number(items[item].damaged_qty);
            var undelivered_qty = Number(items[item].po_qty) - Number(delivered_qty);
            var excess_qty = Number(items[item].scanned_qty) - Number(items[item].po_qty);

            console.log("started send_restatrant_undelivered_po_mail===" + delivered_qty + "===" + undelivered_qty);
            if (undelivered_qty > 0) {
                mail_response += "<tr style=\"font-size: 14px;color: #333333;text-align:center;\"><td>" + items[item].item_name + "</td><td>" + items[item].po_qty + "</td><td>" + delivered_qty + "</td><td>" + undelivered_qty + "</td></tr>";
                console.log("send_restatrant_undelivered_po_mail mail_response==========" + JSON.stringify(mail_response));
                total_undelivered_qty += undelivered_qty;
            }

            if (excess_qty > 0) {
                excess_mail_response += "<tr style=\"font-size: 14px;color: #333333;text-align:center;\"><td>" + items[item].item_name + "</td><td>" + items[item].po_qty + "</td><td>" + delivered_qty + "</td><td>" + excess_qty + "</td></tr>";
                console.log("send_restatrant_excess_quantity_po_mail mail_response==========" + JSON.stringify(excess_mail_response));
                total_excess_qty += excess_qty;
            }
                        
            mail_message_count++;
        }
        
        callback(null, mail_response, items[0].restaurant_id,items[0].po_id, excess_mail_response,total_undelivered_qty,total_excess_qty);
    },
    function (mail_response, restaurant_id,po_id, excess_mail_response,total_undelivered_qty,total_excess_qty, callback) {
        console.log("#################************############*************#### send_restatrant_undelivered_po_mail items==========" + JSON.stringify(items));

        $.ajax({
            type: 'POST',
            url: HQ_URL + "/outlet_mobile/send_restaurant_undelivered_po_mail",
            data: JSON.stringify({
                "mail_content": mail_response,
                "restaurant_id": restaurant_id,
                "po_id": po_id,
                "excess_mail_response": excess_mail_response,
                "total_undelivered_qty": total_undelivered_qty,
                "total_excess_qty": total_excess_qty
            }),
            success: function (data) {
                items = [];
                console.log("undelivered mail sent successfully");
                // and decrease the counter                
            },
            error: function (jqxhr, textStatus, error) {
                var err_msg = textStatus + ", " + jqxhr.responseText;
                console.error("undelivered mail sent failed: " + err_msg);
            },
            contentType: "application/json",
            dataType: 'text'
        });
        callback(null, 'done');
    }], function (err, result) {
        if(err)
        {
            console.log(err);
        }
        if (result)
        {
            console.log("undelivered/ Excess mail sent successfully");
        }
    });
}

getItemDetails();

// Get food item details every 1 hr
setInterval(getItemDetails(), 3600 * 1000);

function getItemDetails() {
    var jqxhr = $.getJSON(HQ_URL + '/food_item/price_info/' + OUTLET_ID)
    .done(function (data) {
        console.log('Received price data');
        for (var i = 0; i < data.length; i++) {
            food_item_data[data[i]["id"]] = {
                "mrp": data[i]["mrp"],
                "master_id": data[i]["master_id"],
                "name": data[i]["name"],
                "item_tag": data[i]["item_tag"],
                "veg": data[i]["veg"],
                "service_tax_percent": data[i]["service_tax_percent"],
                "abatement_percent": data[i]["abatement_percent"],
                "vat_percent": data[i]["vat_percent"],
                "location": data[i]["location"],
                "side_order": data[i]["side_order"],
                "restaurant_details": {
                    "id": data[i]["r_id"],
                    "name": data[i]["r_name"],
                    "address": data[i]["r_address"],
                    "st_no": data[i]["r_st_no"],
                    "pan_no": data[i]["r_pan_no"],
                    "tin_no": data[i]["r_tin_no"]
                },
                "coke_details": {
                    "id": data[i]["b_id"],
                    "name": data[i]["b_name"],
                    "mrp": data[i]["b_mrp"],
                    "st": data[i]["b_service_tax_percent"],
                    "abt": data[i]["b_abatement_percent"],
                    "vat": data[i]["b_vat_percent"],
                    "discount_percent": data[i]["discount_percent"],
                    "restaurant_details":
                                {
                                    "id": data[i]["b_r_id"],
                                    "name": data[i]["b_r_name"],
                                    "address": data[i]["b_r_address"],
                                    "st_no": data[i]["r_st_no"],
                                    "pan_no": data[i]["r_pan_no"],
                                    "tin_no": data[i]["b_r_tin_no"]
                                }
                },
                "heating_reqd": data[i]["heating_required"],
                "heating_reduction": data[i]["heating_reduction"],
                "condiment_slot": data[i]["condiment_slot"],
                "stock_quantity": -1
            }
        }
    })
    .fail(function (jqxhr, textStatus, error) {
        var err_msg = textStatus + ", " + error;
        console.error("Request Failed: " + err_msg);
    });
}

var specialKeys = new Array();
specialKeys.push(8); //Backspace


$('body').on('keypress', ".numeric", function (e) {
    var keyCode = e.which ? e.which : e.keyCode
    var ret = ((keyCode >= 48 && keyCode <= 57) || specialKeys.indexOf(keyCode) != -1);
    return ret;
});

$(".numeric").bind("paste", function (e) {
    return false;
});
$(".numeric").bind("drop", function (e) {
    return false;
});

String.prototype.splice = function (idx, rem, str) {
    return this.slice(0, idx) + str + this.slice(idx + Math.abs(rem));
};

// First, checks if it isn't implemented yet.
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
              ? args[number]
              : match
            ;
        });
    };
}

function timeNow() {
    var d = new Date(),
        h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
        m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    return h + ':' + m + ':00';
}
