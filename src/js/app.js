var deferredInstallPrompt = null;

var vueObject = new Vue({
    el: '#app',
    data: {
        // State control
        isProcessing: false,
        isListEmpty: true,
        isInstallable: false,
        showInstallHint: false,
        // To Do list
        nextToDoItemInput: '',
        stodopidlyList: storageGetList(),
    },
    methods: {
        checkStodopidlyList: function () {
            if (vueObject.stodopidlyList.length === 0) {
                vueObject.isListEmpty = true;
            } else {
                vueObject.isListEmpty = false;
            }
            storageSaveList(vueObject.stodopidlyList);
        },
        addNextToDoItem: function () {
            var trimmed = vueObject.nextToDoItemInput.trim();
            if (!trimmed) return;
            vueObject.stodopidlyList.push(trimmed);
            vueObject.nextToDoItemInput = '';
            vueObject.isListEmpty = false;
            vueObject.checkStodopidlyList();
        },
        removeToDoItem: function (index) {
            this.$delete(this.stodopidlyList, index);
            vueObject.checkStodopidlyList();
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

    // Show the pill, then quietly hide it after 5 s
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
