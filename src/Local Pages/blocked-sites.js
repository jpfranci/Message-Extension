let urlsToBlock = [];
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
        // getting justDomainName for example sub.main.com becomes main.com
        let justDomainName = tmp.hostname.split(".");
        if (justDomainName.length >= 2) {
            justDomainName = 
                `${justDomainName[justDomainName.length - 2]}.${justDomainName[justDomainName.length - 1]}`;
        } else {
            justDomainName = tmp.hostname;
        }

        if (!urlsToBlock.includes("*://*." + justDomainName + "/*")) {
            urlsToBlock.push("*://*." + justDomainName + "/*");
            if (document.getElementById('noBlock')) {
                document.getElementById('noBlock').remove();
            }
            addEntry(justDomainName, false);
            setBlockStorage();
        } else {
            alert("Error: Already have that site blocked");
        }
    } catch(e) {
        console.log(e);
        alert('Not a valid website, please try again. Make sure you have http:// or https:// in there');
    }
});

document.getElementById('remove-button').addEventListener('click', () => {
    let selectedEntries = document.getElementsByClassName('selected');
    console.log(selectedEntries[0]);
    console.log(selectedEntries[1]);
    let length = selectedEntries.length;
    for (let i = 0; i < length; i++) {
        urlsToBlock.splice(urlsToBlock.indexOf("*://*." + selectedEntries[0].innerText + "/*"), 1);
        selectedEntries[0].remove();
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