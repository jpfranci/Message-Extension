const PROGRAM_STATE = "programState";
const PROGRAM_START_MESSAGE = "starting app";
const PROGRAM_END_MESSAGE = "ending app";

let introMessageArray = ["Let's get to business", "Believe in yourself", "You can do this"];

import {storage, getRandomIndexToAccess, runtime} from "./bgd.js";
export {PROGRAM_START_MESSAGE, PROGRAM_END_MESSAGE, PROGRAM_STATE};

// EFFECTS: gets the introMessage array from chrome storage and sets the user greeting
// as a random element within introMessage
function setGreeting() {
    let elementToChange = document.getElementById("set_greeting");
    if (elementToChange !== null) {
        let length = introMessageArray.length;
        let indexToAccess = getRandomIndexToAccess(length);
        elementToChange.innerHTML = introMessageArray[indexToAccess];
        checkEventState();
    }

}

function checkEventState() {
    storage.get(PROGRAM_STATE, setButtonAndProgramState);
}

function setButtonAndProgramState(data) {
    let button = document.getElementById('buttonID');
    let programState = data[PROGRAM_STATE];

    if (programState) {
        button.innerText = "Ready to take a break?";
    } else {
        button.innerText = "Let's get to work";
    }

    document.getElementById('buttonID').addEventListener('click', function () {
        storage.set({[PROGRAM_STATE]: !programState}, function () {
            if(!programState) {
                button.innerText = "Closing unproductive apps";
                runtime.sendMessage("starting app");
                setTimeout(function() {createTimerTabIfNeeded()}, 2000);
            } else {
                button.innerText = "Good work today";
                runtime.sendMessage("ending app");
            }
            setTimeout(function() {close();}, 2000);
        })
    });
}

function createTimerTabIfNeeded() {
    chrome.tabs.query({url: chrome.extension.getURL("../Local Pages/blocked.html")}, function (tabs) {
        if (tabs.length === 0) {
            chrome.tabs.create({url: chrome.extension.getURL("../Local Pages/blocked.html")});
        }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    setGreeting();
});