import {storage, BLOCKED_ALARM_TIME_STORAGE, BLOCKED_STATUS, BREAK_ALARM_TIME_STORAGE, cuteMessageIdentifier} from "../Background/bgd.js";
import { getImageToUse, showNotification} from "./options.js";
import {PROGRAM_STATE} from "../Background/popup.js";

console.log(document);
let timeFromNow;
let button = document.getElementById("demo");

document.getElementById("lol").src = getImageToUse();

chrome.runtime.onMessage.addListener(function(message) {
    let messages = message.split(cuteMessageIdentifier);

    if (messages.length > 1) {
        showNotification(messages[1], document);
    }
});

button.addEventListener("click", function () {
    storage.get(PROGRAM_STATE, function(data) {
       if (data.programState) {
           getParametersToStartTimer();
       } else {
           button.innerText = "Program isn't active";
       }
    });
});

function getParametersToStartTimer() {
    storage.get(BLOCKED_STATUS, function (data) {
        let isBlocked = data[BLOCKED_STATUS];
        if (data.blocked) {
            storage.get(BLOCKED_ALARM_TIME_STORAGE, function (data) {
                startCountdown(data[BLOCKED_ALARM_TIME_STORAGE], isBlocked);
            });
        }
        else {
            storage.get(BREAK_ALARM_TIME_STORAGE, function (data) {
                startCountdown(data[BREAK_ALARM_TIME_STORAGE], isBlocked);
            });
        }
    });
}

function startCountdown(timeOfAlarm, isBlocked) {
    timeFromNow = timeOfAlarm;
    let toCountdownTo = new Date(timeFromNow);
    let captions = getCaptions(isBlocked);

    controlTimer(toCountdownTo, captions);
}


function showClickAgainMessageIfNeeded(captions) {
    if (button.innerText === captions[1]) {
        button.innerText = captions[2];
    }
}

function controlTimer(toCountdownTo, captions) {
    let timerInterval = setInterval(function () {

        button.addEventListener('click', function () {
            clearInterval(timerInterval);
        });

        chrome.storage.onChanged.addListener(function (changes, namespace) {
            console.log(changes);
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

        button.innerText = captions[0] + minutes + " min " + seconds + " sec";

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