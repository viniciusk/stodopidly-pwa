var vueObject = new Vue({
    el: '#app',
    data: {
        // State control
        isProcessing: false,
        isListEmpty: true,
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
    }
});
// On page ready
(function () {
    vueObject.checkStodopidlyList();
})();
