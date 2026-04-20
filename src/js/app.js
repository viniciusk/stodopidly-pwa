var deferredInstallPrompt = null;

/*
 * stodopidlyList holds objects: { text: string, removing: boolean }
 * Storage still persists plain strings — conversion happens on load/save.
 */
var vueObject = new Vue({
    el: '#app',
    data: {
        // State control
        isProcessing:    false,
        isListEmpty:     true,
        isInstallable:   false,
        showInstallHint: false,
        // To Do list (objects in memory, strings in localStorage)
        nextToDoItemInput: '',
        stodopidlyList: (storageGetList() || []).map(function (text) {
            return { text: text, removing: false };
        }),
    },
    methods: {
        checkStodopidlyList: function () {
            vueObject.isListEmpty = vueObject.stodopidlyList.length === 0;
            // Persist only the text; removing-state is transient
            storageSaveList(vueObject.stodopidlyList.map(function (item) {
                return item.text;
            }));
        },

        addNextToDoItem: function () {
            var trimmed = vueObject.nextToDoItemInput.trim();
            if (!trimmed) return;
            vueObject.stodopidlyList.push({ text: trimmed, removing: false });
            vueObject.nextToDoItemInput = '';
            vueObject.isListEmpty = false;
            vueObject.checkStodopidlyList();
            // Return focus to the input immediately so the next item can be typed
            vueObject.$nextTick(function () {
                vueObject.$refs.nextToDoItem.focus();
            });
        },

        removeToDoItem: function (index) {
            var item = vueObject.stodopidlyList[index];
            if (!item || item.removing) return;   // ignore double-taps

            // 1. Mark as removing — CSS strikethrough + "done" label appear
            vueObject.$set(vueObject.stodopidlyList, index, {
                text: item.text,
                removing: true
            });

            // Keep a reference so we can find the item even if indices shift
            var ref = vueObject.stodopidlyList[index];

            // 2. After a short pause, remove from the array
            setTimeout(function () {
                var i = vueObject.stodopidlyList.indexOf(ref);
                if (i !== -1) {
                    vueObject.$delete(vueObject.stodopidlyList, i);
                    vueObject.checkStodopidlyList();
                }
            }, 300);
        },

        installApp: function () {
            if (!deferredInstallPrompt) return;
            vueObject.showInstallHint = false;
            deferredInstallPrompt.prompt();
            deferredInstallPrompt.userChoice.then(function () {
                deferredInstallPrompt = null;
                vueObject.isInstallable = false;
            });
        }
    }
});

// On page ready
(function () {
    vueObject.checkStodopidlyList();
})();

// Catch the browser's install prompt and surface a brief hint
window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    vueObject.isInstallable = true;
    vueObject.showInstallHint = true;
    setTimeout(function () {
        vueObject.showInstallHint = false;
    }, 5000);
});

// Hide once installed
window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    vueObject.isInstallable = false;
    vueObject.showInstallHint = false;
});
