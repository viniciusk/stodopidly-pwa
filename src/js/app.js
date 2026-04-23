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
            return { id: Date.now() + Math.random(), text: text, removing: false };
        }),
        // Single-tap selection
        selectedIndex: null,
        // Drag / tap state
        dragIndex: null,
        dragPointerId: null,
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
            vueObject.stodopidlyList.push({ id: Date.now() + Math.random(), text: trimmed, removing: false });
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

            // Clear selection immediately
            vueObject.selectedIndex = null;

            // 1. Mark as removing — MUST preserve id so transition-group
            //    keeps the element alive and plays the animation.
            vueObject.$set(vueObject.stodopidlyList, index, {
                id:       item.id,
                text:     item.text,
                removing: true
            });

            // Keep a reference so we can find the item even if indices shift
            var ref = vueObject.stodopidlyList[index];

            // 2. After the animation window, remove from the array
            setTimeout(function () {
                var i = vueObject.stodopidlyList.indexOf(ref);
                if (i !== -1) {
                    vueObject.pushToDeleted(ref.text);
                    vueObject.$delete(vueObject.stodopidlyList, i);
                    vueObject.checkStodopidlyList();
                }
            }, 500);
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

            this.stodopidlyList.push({ id: Date.now() + Math.random(), text: text, removing: false });
            this.isListEmpty = false;
            this.checkStodopidlyList();
        },

        // ── Pointer / tap handling ────────────────────────────────

        onPointerDown: function(index, event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (this.stodopidlyList[index].removing) return;
            if (this.isDragging) return;

            this.pointerDownX  = event.clientX;
            this.pointerDownY  = event.clientY;
            this.dragPointerId = event.pointerId;

            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }

            var self = this;
            var capturedIndex = index;

            // If pressing the "done" button specifically, don't initiate a drag
            if (event.target.classList.contains('todo-done-btn')) return;

            // If already selected, we use a much shorter "immediate-ish" delay (120ms)
            // to allow a quick tap or double-tap to win over a drag start.
            var delay = (this.selectedIndex === index) ? 100 : 222;

            this.longPressTimer = setTimeout(function() {
                self.longPressTimer = null;
                self.isDragging    = true;
                self.selectedIndex = null;
                self.dragIndex     = capturedIndex;

                var list = document.querySelector('.todo-items');
                if (list && list.setPointerCapture) {
                    try { list.setPointerCapture(event.pointerId); } catch(e) {}
                }
            }, delay);
        },

        onPointerUp: function(index, event) {
            // This fires on the <li> BEFORE the document-level pointerup.
            // So we handle tap selection here and flag it done.
            var didLongPress = (this.longPressTimer === null && this.isDragging);

            if (this.longPressTimer) {
                // Short tap — long press never fired
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;

                var now = Date.now();
                var lastTap = this._lastTapTime || 0;
                var lastIdx = this._lastTapIndex;

                if (now - lastTap < 320 && lastIdx === index) {
                    // Double-tap detected — delete
                    this._lastTapTime  = 0;
                    this._lastTapIndex = null;
                    this.removeToDoItem(index);
                } else {
                    // Single tap — select / deselect
                    this._lastTapTime  = now;
                    this._lastTapIndex = index;
                    if (this.selectedIndex === index) {
                        this.selectedIndex = null;
                    } else {
                        this.selectedIndex = index;
                    }
                }
            }

            // End drag if one was active
            if (this.isDragging) {
                this.checkStodopidlyList();
                this.isDragging = false;
                this.dragIndex  = null;
                var list = document.querySelector('.todo-items');
                if (list && list.releasePointerCapture && this.dragPointerId !== null) {
                    try { list.releasePointerCapture(this.dragPointerId); } catch(e) {}
                }
                this.dragPointerId = null;
            }
        },

        onDocumentPointerMove: function(event) {
            if (event.pointerId !== this.dragPointerId) return;

            if (!this.isDragging) {
                // Not dragging yet — cancel long-press if finger moved too much
                if (this.longPressTimer) {
                    var dx = event.clientX - this.pointerDownX;
                    var dy = event.clientY - this.pointerDownY;
                    if (Math.sqrt(dx * dx + dy * dy) > 8) {
                        clearTimeout(this.longPressTimer);
                        this.longPressTimer = null;
                        this.dragPointerId  = null;
                    }
                }
                return;
            }

            // Drag active — find new slot by comparing Y to each item's midpoint
            var clientY = event.clientY;
            var list = document.querySelector('.todo-items');
            if (!list) return;

            var items = Array.prototype.slice.call(list.querySelectorAll('li.todo-item'));
            var targetIndex = this.dragIndex;

            for (var i = 0; i < items.length; i++) {
                var rect = items[i].getBoundingClientRect();
                var mid  = rect.top + rect.height / 2;
                if (i < this.dragIndex && clientY < mid) {
                    targetIndex = i;
                    break;
                }
                if (i > this.dragIndex && clientY > mid) {
                    targetIndex = i;
                }
            }

            if (targetIndex !== this.dragIndex) {
                var dragged = this.stodopidlyList.splice(this.dragIndex, 1)[0];
                this.stodopidlyList.splice(targetIndex, 0, dragged);
                this.dragIndex = targetIndex;
            }
        },

        stopDrag: function(event) {
            // Called by document-level pointerup/cancel.
            // onPointerUp on the <li> handles taps — this only cleans up drag state.
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            if (this.isDragging) {
                this.checkStodopidlyList();
                this.isDragging = false;
                this.dragIndex  = null;
                var list = document.querySelector('.todo-items');
                if (list && list.releasePointerCapture && this.dragPointerId !== null) {
                    try { list.releasePointerCapture(this.dragPointerId); } catch(e) {}
                }
                this.dragPointerId = null;
            }
        },

        onDoubleTap: function(index, event) {
            // Kept for desktop mouse users where dblclick is reliable
            if (this.isDragging) return;
            event.preventDefault();
            this._lastTapTime  = 0; // prevent triple-delete
            this._lastTapIndex = null;
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

// Document-level pointer listeners for drag (pointer capture means these fire
// even when the pointer moves between list items or outside the list entirely)
document.addEventListener('pointermove', function(e) {
    vueObject.onDocumentPointerMove(e);
});
document.addEventListener('pointerup', function(e) {
    vueObject.stopDrag(e);
});
document.addEventListener('pointercancel', function(e) {
    vueObject.stopDrag(e);
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
