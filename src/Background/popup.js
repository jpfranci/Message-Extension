const PROGRAM_STATE = "programState";
const PROGRAM_START_MESSAGE = "starting app";
const PROGRAM_END_MESSAGE = "ending app";

let introMessageArray = ["Let's get to business", "Believe in yourself", "You can do this"];
let timer = document.getElementById("timer");
let timeFromNow;

import {storage, getRandomIndexToAccess, runtime, 
    BLOCKED_STATUS, BLOCKED_ALARM_TIME_STORAGE, BREAK_ALARM_TIME_STORAGE} from "./bgd.js";
export {PROGRAM_START_MESSAGE, PROGRAM_END_MESSAGE, PROGRAM_STATE};


startTimer(timer);

function startTimer(button) {
    chrome.storage.sync.get(PROGRAM_STATE, function(data) {
        if (data.programState) {
            getParametersToStartTimer(button);
        } 
     });
}

function getParametersToStartTimer(button) {
    storage.get(BLOCKED_STATUS, function (data) {
        let isBlocked = data[BLOCKED_STATUS];
        if (data.blocked) {
            storage.get(BLOCKED_ALARM_TIME_STORAGE, function (data) {
                startCountdown(data[BLOCKED_ALARM_TIME_STORAGE], isBlocked, button);
            });
        }
        else {
            storage.get(BREAK_ALARM_TIME_STORAGE, function (data) {
                startCountdown(data[BREAK_ALARM_TIME_STORAGE], isBlocked, button);
            });
        }
    });
}

function startCountdown(timeOfAlarm, isBlocked, button) {
    timeFromNow = timeOfAlarm;
    let toCountdownTo = new Date(timeFromNow);
    let captions = getCaptions(isBlocked);

    controlTimer(toCountdownTo, captions, button);
}


function showClickAgainMessageIfNeeded(captions, button) {
    if (button.innerText === captions[1]) {
        button.innerText = captions[2];
    }
}

function controlTimer(toCountdownTo, captions, button) {
    let timerInterval = setInterval(function () {
        chrome.storage.onChanged.addListener(function (changes, namespace) {
            if (changes[BLOCKED_ALARM_TIME_STORAGE]) {
                toCountdownTo = new Date(changes[BLOCKED_ALARM_TIME_STORAGE].newValue);
            } else if (changes[BREAK_ALARM_TIME_STORAGE]) {
                timeFromNow = new Date(changes[BREAK_ALARM_TIME_STORAGE].newValue);
            }
        });

        let now = Date.now();
        let distance = toCountdownTo - now;
        let seconds = Math.floor((distance / 1000) % 60);
        let minutes = Math.floor((distance / 1000 / 60) % 60);

        if (button) {
            button.innerText = captions[0] + minutes + " min " + seconds + " sec";
        }

        if (distance < 0) {
            clearInterval(timerInterval);
            button.innerText = captions[1];
            setTimeout(function() {showClickAgainMessageIfNeeded(captions)}, 5000);
        }
    }, 1000);
}

function getCaptions(isBlocked) {
    if (isBlocked) {
        return ["Time Until Break: ", "Go take your well-deserved break",
            "Click this button again to show break timer"];
    } else {
        return ["Time Until Break's Over: ", "Time to go back to work!",
            "Click this button again to show block timer"];
    }
}


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