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
        dragIndex: null,
        dragTargetIndex: null,
        longPressTimer: null,
        isDragging: false,
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

        removeToDoItemWrapper: function (index) {
            // Only fire remove if a drag was not just completed
            if (!this.isDragging) {
                this.removeToDoItem(index);
            }
        },
        
        onPointerDown: function(index, event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            
            // If already dragging or removing, ignore
            if (this.isDragging || this.stodopidlyList[index].removing) return;
            
            // clear any existing timer
            if (this.longPressTimer) clearTimeout(this.longPressTimer);
            
            var self = this;
            this.longPressTimer = setTimeout(function() {
                self.isDragging = true;
                self.dragIndex = index;
                self.dragTargetIndex = index;
                if (event.target.setPointerCapture) {
                    event.target.setPointerCapture(event.pointerId);
                }
            }, 350); // 350ms long press to pickup
        },

        onPointerMove: function(event) {
            if (this.isDragging) {
                // Determine target index
                var clientX = event.clientX;
                var clientY = event.clientY;
                
                var el = document.elementFromPoint(clientX, clientY);
                if (el) {
                    var li = el.closest('li.todo-item');
                    if (li && li.parentNode) {
                        var siblings = Array.prototype.slice.call(li.parentNode.children);
                        var targetIndex = siblings.indexOf(li);
                        // Make sure we only index the draggable items
                        if (targetIndex !== -1 && targetIndex !== this.dragTargetIndex) {
                            this.dragTargetIndex = targetIndex;
                        }
                    }
                }
            } else if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        },

        onPointerUp: function(event) {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            
            if (this.isDragging) {
                var from = this.dragIndex;
                var to = this.dragTargetIndex;
                
                if (from !== null && to !== null && from !== to && to < this.stodopidlyList.length) {
                    // reorder array
                    var item = this.stodopidlyList.splice(from, 1)[0];
                    this.stodopidlyList.splice(to, 0, item);
                    this.checkStodopidlyList();
                }
                
                var self = this;
                // delay clearing isDragging to block the click event that fires afterward
                setTimeout(function() {
                    self.isDragging = false;
                    self.dragIndex = null;
                    self.dragTargetIndex = null;
                    if (event.target.releasePointerCapture) {
                        try { event.target.releasePointerCapture(event.pointerId); } catch(e){}
                    }
                }, 50);
            }
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
