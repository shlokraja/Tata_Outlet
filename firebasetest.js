var firebase = require('firebase');
var express = require('express');
var router = express();
var referenceno = '0123456';

var firebase_connection = "https://atchayam-dev.firebaseio.com";
var rootref = new firebase(firebase_connection);

function SaveDataToFirebase(mobileno, content) {
    rootref.child('users').child(referenceno).set({ "mobileno": mobileno, "content": content });
    rootref.child('TestFirebaseData').child('0123456789').set({ "mobileno": '98994498944', "content": '98994498944 content message' });
    console.log(mobileno);
}



function ReadDataFromFirebase() {
    // read otp from firebase
    rootref.child('users').child(referenceno).on('value', function (snapshot) {
        // console.log("Mobile no from Firebase: " + mobileno);

        snapshot.forEach(function (childSnapshot) {
            var key = childSnapshot.key();
            var value = childSnapshot.val();

            if (key === 'mobileno')
            {
                console.log("Key from Firebase: " + key + " mobileno from Firebase: " + value);
            }

            if (key === 'content')
            {
                console.log("Key from Firebase: " + key + " content from Firebase: " + value);
            }
        });
    });

    // read otp from firebase
    rootref.child('TestFirebaseData').child('0123456789').on('value', function (snapshot) {
        // console.log("Mobile no from Firebase: " + mobileno);

        snapshot.forEach(function (childSnapshot) {
            var key = childSnapshot.key();
            var value = childSnapshot.val();

            if (key === 'mobileno')
            {
                console.log("Key from Firebase: " + key + " mobileno from Firebase: " + value);
            }

            if (key === 'content')
            {
                console.log("Key from Firebase: " + key + " content from Firebase: " + value);
            }
        });
    });
}

SaveDataToFirebase('123456789123456789', 'TEst content msg');

ReadDataFromFirebase();
