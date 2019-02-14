let urlsToBlock;
const BLOCKED_SITE_STORAGE = 'blockedSites';

let listOfSites = document.getElementById("messageListId");

chrome.storage.sync.get([BLOCKED_SITE_STORAGE], (blockedSites) => {
    if(blockedSites[BLOCKED_SITE_STORAGE]) {
        urlsToBlock = blockedSites[BLOCKED_SITE_STORAGE];
        console.log(urlsToBlock);
        if (urlsToBlock.length > 0) {
            document.getElementById('noBlock').remove();
            urlsToBlock.forEach((url) => {addEntry(url, true)});
        } 
    }
})

function addEntry(url, isAlreadyRegex) {
    let newMessageEntry = document.createElement("li");
    let messageText = document.createElement("p");
    
    console.log(isAlreadyRegex);
    messageText.className = "li-message";
    
    // Get just domain name (facebook.com)
    if (isAlreadyRegex) {
        url = url.substring(url.indexOf('.') + 1, url.length-2);
    }

    messageText.innerText = url;
    newMessageEntry.appendChild(messageText);
    listOfSites.appendChild(newMessageEntry);
    messageText.addEventListener('click', () => {
        selectEntry(messageText);
    });
}

document.getElementById('website-button').addEventListener('click', () => {
    try {
        let urlEntered = document.getElementById("website-input").value;
        document.getElementById('website-input').value = "";
        // testing if valid url
        new URL(urlEntered);
        let tmp = document.createElement('a');
        tmp.href = urlEntered;
        urlsToBlock.push("*://*." + tmp.hostname + "/*");
        if (document.getElementById('noBlock')) {
            document.getElementById('noBlock').remove();
        }
        addEntry(tmp.hostname, false);
        setBlockStorage();
    } catch(e) {
        console.log(e);
        alert('Not a valid website, please try again. Make sure you have http:// or https:// in there');
    }
});

document.getElementById('remove-button').addEventListener('click', () => {
    let selectedEntries = document.getElementsByClassName('selected');
    for (let i = 0; i < selectedEntries.length; i++) {
        urlsToBlock.splice(urlsToBlock.indexOf("*://*." + selectedEntries[i].innerText + "/*"), 1);
        selectedEntries[i].remove();
    }
    setBlockStorage();
});

function setBlockStorage() {
    chrome.storage.sync.set({[BLOCKED_SITE_STORAGE]:urlsToBlock}, () => {
        chrome.storage.sync.get([BLOCKED_SITE_STORAGE], (data) => {
            console.log(data[BLOCKED_SITE_STORAGE]);
        });
    });
}

function selectEntry(entry) {
    if (entry.classList.contains('selected')) {
        entry.classList.remove('selected');
    } else {
        entry.classList.add('selected');
    }
}