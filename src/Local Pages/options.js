import {storage, getRandomIndexToAccess, BREAK_ALARM_TIME, cuteMessageIdentifier} from "../Background/bgd.js";

let images = ["../images/IMG_8622.jpg","../images/IMG_8624.jpg","../images/IMG_8630.jpg","../images/IMG_8640.jpg","../images/IMG_8648.jpg","../images/IMG_8664.jpg","../images/IMG_8683.jpg","../images/IMG_8685.jpg","../images/IMG_8710.jpg","../images/IMG_8796.jpg","../images/IMG_8808.jpg","../images/IMG_8809.jpg","../images/IMG_8811.jpg","../images/IMG_8814.jpg","../images/lol.jpeg","../images/lol2.jpeg","../images/lol3.jpg","../images/lol4.jpeg"];
let lengthImages = images.length;

const MIN_BLOCK_TIME = 25;
const MIN_FREQUENCY_TIME = 0.1;
const MAX_BREAK_TIME = 10;
const TIMEOUT = 12000;

export {getImageToUse, showNotification};

// Listens for a message and creates a notification box on top right of tab if
// message is a periodic one
chrome.runtime.onMessage.addListener(function(message) {
    displayNotificationBoxIfPeriodicMessage(message);
});

// Checks if message is a periodic message and creates notification box on top right of tab
function displayNotificationBoxIfPeriodicMessage(message) {
    let messages = message.split(cuteMessageIdentifier);

    if (messages.length > 1) {
        showNotification(messages[1], document);
    }
}

// Creates a notification box and injects necessary fonts for styling, removes the box when clicked or
// automatically after TIMEOUT seconds
function showNotification(message, document) {
    let montserratFontFace = new FontFace('Montserrat', 'url(https://fonts.gstatic.com/s/' +
        'montserrat/v12/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2)');
    document.fonts.add(montserratFontFace);

    let newMessage = document.createElement("div");
    newMessage.className = "fancy-box-inject";
    newMessage.id = "injectedScript";

    let messageTextHeader = document.createElement("h3");
    messageTextHeader.className = 'header-message';
    messageTextHeader.innerText = "A message for you";
    newMessage.appendChild(messageTextHeader);

    let messageText = document.createElement("h3");
    messageText.className = "fancy-heading-inject";
    messageText.innerText = message;
    newMessage.appendChild(messageText);
    document.body.appendChild(newMessage);

    newMessage.addEventListener("click", function () {
        newMessage.remove();
    });

    setTimeout(function () {
        newMessage.remove();
    }, TIMEOUT);
}

function getImageToUse() {
    lengthImages = images.length;
    console.log(lengthImages);
    return images[getRandomIndexToAccess(lengthImages)];
}

// Changes image to display at centre of screen if valid document and sets labels for input boxes to
// their current storage time, changes stored times if valid input by user
document.addEventListener('DOMContentLoaded', function() {
    let imageHolder = document.getElementById("imageInserted");
    if (imageHolder != null) {
        document.getElementById("imageInserted").src = getImageToUse();
        setLabelsToTime();
        changeStoredTimesIfValidInput();
    }
});

function setLabelsToTime() {
    storage.get('blockedTime', function (data) {
        document.getElementById("blockLabel").innerHTML = 'Current Block Duration: ' + data.blockedTime
            + ' min';
    });
    storage.get('messageFrequency', function (data) {
        document.getElementById("cuteMessageLabel").innerHTML = 'Current Frequency Of Messages: ' +
            data.messageFrequency + ' min';
    });
    storage.get(BREAK_ALARM_TIME, function(data) {
        document.getElementById("breakLabel").innerHTML = 'Current Break Time: ' + data.breakTime
            + ' min';
    });
}

function changeStoredTimesIfValidInput() {
    document.getElementById("cuteMessageButton").addEventListener('click', changeCuteMessageFrequencyIfValid);
    document.getElementById("blockMessageButton").addEventListener('click', changeBlockTimeIfValid);
    document.getElementById("breakMessageButton").addEventListener('click', changeBreakTimeIfValid);
}

function changeCuteMessageFrequencyIfValid() {
    let numMinutes = getInputValue("cuteMessage");

    if (!isNaN(numMinutes) && numMinutes >= MIN_FREQUENCY_TIME) {
        setNewTimeAndChangeLabel(numMinutes, "messageFrequency", "cuteMessageLabel");
    }
}

function changeBlockTimeIfValid() {
    let numMinutes = getInputValue("blockMessage");

    if (!isNaN(numMinutes)) {
        if (numMinutes < MIN_BLOCK_TIME) {
            document.getElementById("blockLabel").innerHTML = numMinutes + " min is less than "
                + MIN_BLOCK_TIME + "min (min time for block), nice try punk";
            setTimeout(setLabelsToTime, 3000);
        } else {
            setNewTimeAndChangeLabel(numMinutes, "blockedTime", "blockLabel");
        }
    }
}

function changeBreakTimeIfValid() {
    let numMinutes = getInputValue("breakMessage");

    if (!isNaN(numMinutes)) {
        if (numMinutes > MAX_BREAK_TIME) {
            document.getElementById("breakLabel").innerHTML = numMinutes + " min is more than "
                + MAX_BREAK_TIME + "min (max time for break), smh";
            setTimeout(setLabelsToTime, 3000);
        } else {
            setNewTimeAndChangeLabel(numMinutes, BREAK_ALARM_TIME, "breakLabel");
        }
    }
}

function getInputValue(inputID) {
    let contentButton = document.getElementById(inputID).value;
    return parseFloat(contentButton);
}

function setNewTimeAndChangeLabel(numMinutes, storageTimeName, labelID) {
    storage.set({[storageTimeName]: numMinutes}, function () {
        document.getElementById(labelID).innerHTML = "Setting " +storageTimeName+ " to " + numMinutes + " min";
        setTimeout(setLabelsToTime, 3000);
    });
}