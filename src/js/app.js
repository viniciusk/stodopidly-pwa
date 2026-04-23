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
        // Single-tap selection
        selectedIndex: null,
        // Drag state
        dragIndex: null,
        dragTargetIndex: null,
        longPressTimer: null,
        isDragging: false,
        pointerDownX: null,
        pointerDownY: null,
        deletedItemsStack: storageGetDeletedList() || [],
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
            if (!item || item.removing) return;

            // Clear selection
            vueObject.selectedIndex = null;

            // 1. Mark as removing
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
                    vueObject.pushToDeleted(ref.text);
                    vueObject.$delete(vueObject.stodopidlyList, i);
                    vueObject.checkStodopidlyList();
                }
            }, 300);
        },

        pushToDeleted: function(text) {
            this.deletedItemsStack.push(text);
            if (this.deletedItemsStack.length > 10) {
                this.deletedItemsStack.shift();
            }
            storageSaveDeletedList(this.deletedItemsStack);
        },

        undoLastDelete: function() {
            if (this.deletedItemsStack.length === 0) return;
            var text = this.deletedItemsStack.pop();
            storageSaveDeletedList(this.deletedItemsStack);

            this.stodopidlyList.push({ text: text, removing: false });
            this.isListEmpty = false;
            this.checkStodopidlyList();
        },

        // ── Pointer / tap handling ────────────────────────────────

        onPointerDown: function(index, event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (this.isDragging || this.stodopidlyList[index].removing) return;

            // Record start position for movement threshold
            this.pointerDownX = event.clientX;
            this.pointerDownY = event.clientY;

            if (this.longPressTimer) clearTimeout(this.longPressTimer);

            var self = this;
            this.longPressTimer = setTimeout(function() {
                self.longPressTimer = null;
                self.isDragging = true;
                self.selectedIndex = null;   // deselect while dragging
                self.dragIndex = index;
                self.dragTargetIndex = index;
                if (event.target.setPointerCapture) {
                    try { event.target.setPointerCapture(event.pointerId); } catch(e){}
                }
            }, 400); // 400 ms long-press to pick up
        },

        onPointerMove: function(event) {
            if (this.isDragging) {
                var clientX = event.clientX;
                var clientY = event.clientY;

                var el = document.elementFromPoint(clientX, clientY);
                if (el) {
                    var li = el.closest('li.todo-item');
                    if (li && li.parentNode) {
                        var siblings = Array.prototype.slice.call(li.parentNode.children);
                        var targetIndex = siblings.indexOf(li);
                        if (targetIndex !== -1 && targetIndex !== this.dragTargetIndex) {
                            this.dragTargetIndex = targetIndex;
                        }
                    }
                }
            } else if (this.longPressTimer) {
                // Cancel long-press only if the finger moved more than 10 px
                var dx = event.clientX - this.pointerDownX;
                var dy = event.clientY - this.pointerDownY;
                if (Math.sqrt(dx * dx + dy * dy) > 10) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            }
        },

        onPointerUp: function(index, event) {
            var wasDragging = this.isDragging;

            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }

            if (wasDragging) {
                var from = this.dragIndex;
                var to   = this.dragTargetIndex;

                if (from !== null && to !== null && from !== to && to < this.stodopidlyList.length) {
                    var item = this.stodopidlyList.splice(from, 1)[0];
                    this.stodopidlyList.splice(to, 0, item);
                    this.checkStodopidlyList();
                }

                var self = this;
                setTimeout(function() {
                    self.isDragging = false;
                    self.dragIndex = null;
                    self.dragTargetIndex = null;
                    if (event.target.releasePointerCapture) {
                        try { event.target.releasePointerCapture(event.pointerId); } catch(e){}
                    }
                }, 50);
            } else {
                // Single-tap: select / deselect
                if (this.selectedIndex === index) {
                    this.selectedIndex = null;   // tap again to deselect
                } else {
                    this.selectedIndex = index;
                }
            }
        },

        onDoubleTap: function(index, event) {
            // Double-click / double-tap always deletes (skip if mid-drag)
            if (this.isDragging) return;
            event.preventDefault();
            this.removeToDoItem(index);
        },

        onDoneBtn: function(index) {
            this.removeToDoItem(index);
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

// Deselect when tapping outside any list item
document.addEventListener('pointerdown', function(e) {
    if (!e.target.closest('li.todo-item')) {
        vueObject.selectedIndex = null;
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
