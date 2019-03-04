import { storage, BLOCKED_ALARM_TIME_STORAGE, BLOCKED_STATUS, BREAK_ALARM_TIME_STORAGE, messageIdentifier } from "../Background/bgd.js";
import { getImageToUse, showNotification } from "./options.js";
import { PROGRAM_STATE } from "../Background/popup.js";

let timeFromNow;
let button = document.getElementById("demo");

export {startTimer};

if (document.getElementById("lol")) {
    document.getElementById("lol").src = getImageToUse();
}

startTimer(button);

function startTimer(timer) {
    storage.get(PROGRAM_STATE, function (data) {
        if (data.programState) {
            getParametersToStartTimer(timer);
        } else {
            timer.innerText = "Program isn't active";
        }
    })
}


chrome.runtime.onMessage.addListener(function (message) {
    let messages = message.split(messageIdentifier);

    if (messages.length > 1) {
        showNotification(messages[1]).bind(this);
    }
});

function getParametersToStartTimer(timer) {
    storage.get(BLOCKED_STATUS, function (data) {
        let isBlocked = data[BLOCKED_STATUS];
        if (data.blocked) {
            storage.get(BLOCKED_ALARM_TIME_STORAGE, function (data) {
                startCountdown(data[BLOCKED_ALARM_TIME_STORAGE], isBlocked, timer);
            });
        }
        else {
            storage.get(BREAK_ALARM_TIME_STORAGE, function (data) {
                startCountdown(data[BREAK_ALARM_TIME_STORAGE], isBlocked, timer);
            });
        }
    });
}

function startCountdown(timeOfAlarm, isBlocked, timer) {
    timeFromNow = timeOfAlarm;
    let toCountdownTo = new Date(timeFromNow);
    let captions = getCaptions(isBlocked);

    controlTimer(toCountdownTo, captions, timer);
}


function showClickAgainMessageIfNeeded(captions, timer) {
    if (timer.innerText === captions[1]) {
        timer.innerText = captions[2];
    }
}

function controlTimer(toCountdownTo, captions, timer) {
    let timerInterval = setInterval(() => {
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

        if (timer){
            timer.innerText = captions[0] + minutes + " min " + seconds + " sec";
        }

        if (distance < 0 && timer) {
            clearInterval(timerInterval);
            timer.innerText = captions[1];
            setTimeout(function () { showClickAgainMessageIfNeeded(captions) }, 5000);
        }
    }, 1000);
}

function getCaptions(isBlocked) {
    if (isBlocked) {
        return ["Time Until Break: ", "Go take your well-deserved break",
            "Click this timer again to show break timer"];
    } else {
        return ["Time Until Break's Over: ", "Time to go back to work!",
            "Click this timer again to show block timer"];
    }
}