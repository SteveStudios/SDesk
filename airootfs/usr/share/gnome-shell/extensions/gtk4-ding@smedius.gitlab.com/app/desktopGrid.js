/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Gtk4 Port Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import {Gtk, Gdk, GLib, Gio, Graphene, Gsk, Adw} from '../dependencies/gi.js';
import {_} from '../dependencies/gettext.js';

export {DesktopGrid};

var elementSpacing = 2;

// eslint-disable-next-line no-unused-vars
const DesktopGrid = class {
    constructor(desktopManager, desktopName, desktopDescription, asDesktop, premultiplied) {
        this._destroying = false;
        this._desktopManager = desktopManager;
        this.Prefs = this._desktopManager.Prefs;
        this.DesktopIconsUtil = this._desktopManager.DesktopIconsUtil;
        this.DBusUtils = this._desktopManager.DBusUtils;
        this.Enums = this._desktopManager.Enums;
        this._desktopName = desktopName;
        this._asDesktop = asDesktop;
        this._premultiplied = premultiplied;
        this._desktopDescription = desktopDescription;
        this._using_X11 = this.DesktopIconsUtil.usingX11();
        this.directoryOpenTimer = null;
        this.updateWindowGeometry();
        this.updateUnscaledHeightWidthMargins();
        this.createGrids();

        this._window = new Adw.ApplicationWindow({application: desktopManager.mainApp, 'title': desktopName});
        if (this._asDesktop) {
            this._window.set_decorated(false);
            this._window.set_deletable(false);
            // Transparent Background only if this instance is working as a desktop
            this._window.set_name('desktopwindow');
            if (this._using_X11) {
                this.DesktopIconsUtil.makeX11windowTaskbarHiddenDesktop(this._window);
            } else { // Wayland
                // Compositer hang on some high resolution requires all windows be maximized to map and display initially.
                this._window.maximize();
                // However this creates an error where the window can be moved by the user by dragging down on top panel.
                // So we unmaximize all windows after they are mapped as maximization is not needed anymore.
                this._window.connect('map', () => this._window.unmaximize());
            }
        } else {
            // Opaque black test window
            let headerBar = Adw.HeaderBar.new();
            let headerTitle = Adw.WindowTitle.new('DING Test Window', '');
            headerBar.set_title_widget(headerTitle);
            headerBar.set_show_end_title_buttons(true);
            this.testbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0);
            this.testbox.append(headerBar);
        }
        this._window.set_resizable(false);
        this._window.connect('close-request', () => {
            if (this._destroying)
                return false;

            if (this._asDesktop) {
                // Do not destroy window when closing if the instance is working as desktop
                return true;
            } else {
                // Exit if this instance is working as an stand-alone window
                this._desktopManager.terminateProgram();
                return false;
            }
        });

        this._container = new Gtk.Fixed();
        this._containerContext = this._container.get_style_context();
        this._containerContext.add_class('unhighlightdroptarget');
        this.sizeContainer(this._container);
        this._overlay = new Gtk.Overlay();
        this._overlay.set_child(this._container);
        if (this._asDesktop) {
            this._window.set_content(this._overlay);
        } else {
            this.testbox.append(this._overlay);
            this._window.set_content(this.testbox);
        }
        this.gridGlobalRectangle = new Gdk.Rectangle();

        this._selectedList = null;

        this.setGridStatus();

        this._window.show();
        this._window.set_size_request(this._windowWidth, this._windowHeight);

        this._drawArea = new Gtk.DrawingArea();
        this._drawArea.set_content_height(this._windowHeight);
        this._drawArea.set_content_width(this._windowWidth);
        this.sizeContainer(this._drawArea);
        this._drawArea.set_draw_func(this._doDrawOnGrid.bind(this));
        this._overlay.add_overlay(this._drawArea);
        this._drawArea.set_can_target(false);

        this._eventKey = Gtk.EventControllerKey.new();
        this._window.add_controller(this._eventKey);
        this._eventMotion = Gtk.EventControllerMotion.new();
        this._eventMotion.set_propagation_phase(Gtk.PropagationPhase.BUBBLE);
        this._container.add_controller(this._eventMotion);
        this._eventKey.connect('key-pressed', (actor, keyval, keycode, state) => {
            this._desktopManager.onKeyPress(keyval, keycode, state, this);
        });
        this._eventMotion.connect('motion', (actor, x, y) => {
            if (!this._desktopManager.rubberBand)
                return false;
            let [X, Y] = this.coordinatesLocalToGlobal(x, y);
            this._desktopManager.onMotion(X, Y);
            return false;
        });
        this._buttonClick = Gtk.GestureClick.new();
        this._buttonClick.set_button(0);
        this._buttonClick.set_propagation_phase(Gtk.PropagationPhase.BUBBLE);
        this._container.add_controller(this._buttonClick);
        this._buttonClick.connect('pressed', (actor, nPress, x, y) => {
            let button = actor.get_current_button();
            let state = this._buttonClick.get_current_event_state();
            let isCtrl = (state & Gdk.ModifierType.CONTROL_MASK) !== 0;
            let isShift = (state & Gdk.ModifierType.SHIFT_MASK) !== 0;
            let [X, Y] = this.coordinatesLocalToGlobal(x, y);
            let clickItem = this._fileAt(x, y);
            if (clickItem) {
                let clickRectangle = new Gdk.Rectangle({x: X, y: Y, width: 1, height: 1});
                if (clickRectangle.intersect(clickItem.iconRectangle)[0] || clickRectangle.intersect(clickItem.labelRectangle)[0]) {
                    clickItem._onPressButton(actor, X, Y, x, y, isShift, isCtrl);
                    return;
                }
            }
            this._desktopManager.onPressButton(X, Y, x, y, button, isShift, isCtrl, this);
        });

        this._buttonClick.connect('released', (actor, nPress, x, y) => {
            let state = this._buttonClick.get_current_event_state();
            let isCtrl = (state & Gdk.ModifierType.CONTROL_MASK) !== 0;
            let isShift = (state & Gdk.ModifierType.SHIFT_MASK) !== 0;
            let [X, Y] = this.coordinatesLocalToGlobal(x, y);
            let clickItem = this._fileAt(x, y);
            if (clickItem && !this._desktopManager.rubberBand) {
                let clickRectangle = new Gdk.Rectangle({x: X, y: Y, width: 1, height: 1});
                if (clickRectangle.intersect(clickItem.iconRectangle)[0] || clickRectangle.intersect(clickItem.labelRectangle)[0]) {
                    clickItem._onReleaseButton(actor, X, Y, x, y, isShift, isCtrl);
                    return;
                }
            }
            this._desktopManager.onReleaseButton(this);
        });
        this.setDropDestination(this._container);
        this.setDragSource(this._container);
        this.updateGridRectangle();
    }

    updateGridDescription(desktopDescription) {
        this._desktopDescription = desktopDescription;
    }

    updateWindowGeometry() {
        this._zoom = this._desktopDescription.zoom;
        this._x = this._desktopDescription.x;
        this._y = this._desktopDescription.y;
        this._monitor = this._desktopDescription.monitorIndex;
        this._sizer = this._zoom;
        if (this._asDesktop) {
            if (this._using_X11)
                this._sizer = Math.ceil(this._zoom);
            else if (this._premultiplied)
                this._sizer = 1;
        }
        this._windowWidth = Math.floor(this._desktopDescription.width / this._sizer);
        this._windowHeight = Math.floor(this._desktopDescription.height / this._sizer);
    }

    resizeWindow() {
        this.updateWindowGeometry();
        this._desktopName = `@!${this._x},${this._y};BDHF`;
        this._window.set_title(this._desktopName);
        this._window.set_default_size(this._windowWidth, this._windowHeight);
        this._window.set_size_request(this._windowWidth, this._windowHeight);
        this.scale = this._window.get_scale_factor();
        this._drawArea.set_content_height(this._windowHeight);
        this._drawArea.set_content_width(this._windowWidth);
    }

    updateUnscaledHeightWidthMargins() {
        this._marginLeftHiddenObject = false;
        this._marginRightHiddenObject = false;
        this._marginTopHiddenObject = false;
        this._marginBottomHiddenObject = false;

        this._marginTop = this._desktopDescription.marginTop;
        if (this._marginTop > 1000) {
            this._marginTopHiddenObject = true;
            this._marginTop -= 1000;
        }
        this._marginBottom = this._desktopDescription.marginBottom;
        if (this._marginBottom > 1000) {
            this._marginBottomHiddenObject = true;
            this._marginBottom -= 1000;
        }
        this._marginLeft = this._desktopDescription.marginLeft;
        if (this._marginLeft > 1000) {
            this._marginLeftHiddenObject = true;
            this._marginLeft -= 1000;
        }
        this._marginRight = this._desktopDescription.marginRight;
        if (this._marginRight > 1000) {
            this._marginRightHiddenObject = true;
            this._marginRight -= 1000;
        }

        this._width = this._desktopDescription.width - this._marginLeft - this._marginRight;
        this._height = this._desktopDescription.height - this._marginTop - this._marginBottom;
    }

    createGrids() {
        this._width = Math.floor(this._width / this._sizer);
        this._height = Math.floor(this._height / this._sizer);
        this._marginTop = Math.floor(this._marginTop / this._sizer);
        this._marginBottom = Math.floor(this._marginBottom / this._sizer);
        this._marginLeft = Math.floor(this._marginLeft / this._sizer);
        this._marginRight = Math.floor(this._marginRight / this._sizer);
        this._maxColumns = Math.floor(this._width / (this.Prefs.DesiredWidth + 4 * elementSpacing));
        this._maxRows =  Math.floor(this._height / (this.Prefs.DesiredHeight + 4 * elementSpacing));
        this._elementWidth = Math.floor(this._width / this._maxColumns);
        this._elementHeight = Math.floor(this._height / this._maxRows);
    }

    updateGridRectangle() {
        this.gridGlobalRectangle.x = this._x + this._marginLeft;
        this.gridGlobalRectangle.y = this._y + this._marginTop;
        this.gridGlobalRectangle.width = this._width;
        this.gridGlobalRectangle.height = this._height;
    }

    sizeContainer(widget) {
        widget.margin_top = this._marginTop;
        widget.margin_bottom = this._marginBottom;
        widget.margin_start = this._marginLeft;
        widget.margin_end = this._marginRight;
    }

    setGridStatus() {
        this._fileItems = {};
        this._gridStatus = {};
        for (let y = 0; y < this._maxRows; y++) {
            for (let x = 0; x < this._maxColumns; x++)
                this._setGridUse(x, y, false);
        }
    }

    resizeGrid() {
        this.updateUnscaledHeightWidthMargins();
        this.createGrids();
        this.sizeContainer(this._container);
        this.sizeContainer(this._drawArea);
        this.updateGridRectangle();
        this.setGridStatus();
    }

    destroy() {
        this._destroying = true;
        this._window.destroy();
    }


    getIntelligentPosition(gdkRectangle) {
        var clickLocation = 'center';

        if ((this._marginLeft > 0) && (gdkRectangle.x < (this._x + this._marginLeft * 2)))
            clickLocation = 'left';

        if ((this._marginRight > 0) && (gdkRectangle.x + gdkRectangle.width > (this._x + this._windowWidth - this._marginRight * 2.5)))
            clickLocation = 'right';

        if ((this._marginBottom > 0) && (gdkRectangle.y + gdkRectangle.height > (this._y + this._windowHeight - this._marginBottom * 2))) {
            switch (clickLocation) {
            case 'left':
                clickLocation = 'bottomleft';
                break;
            case 'right':
                clickLocation = 'bottomright';
                break;
            default:
                clickLocation = 'bottom';
            }
        }
        if ((this._marginTop > 0) && (gdkRectangle.y < (this._y + this._marginTop * 2))) {
            switch (clickLocation) {
            case 'left':
                clickLocation = 'topLeft';
                break;
            case 'right':
                clickLocation = 'topRight';
                break;
            default:
                clickLocation = 'top';
            }
        }

        var returnvalue;

        //* Fix - Currently Gtk4 returns incorrect Gtk.PositionType Enums           *//
        //* Returning Integers instead of Enums                                     *//
        //* Enums Gtk.PositionType.LEFT does not seem to work even when returning 0 *//

        switch (clickLocation) {
        case 'left':
            if (this._marginLeftHiddenObject)
                returnvalue = 1; // Gtk.PositionType.RIGHT;
            else
                returnvalue = null;

            break;
        case 'right':
            if (this._marginRightHiddenObject)
                returnvalue = 1; // Gtk.PositionType.LEFT = 0, overRiding with 1 as it works
            else
                returnvalue = null;

            break;
        case 'top':
            if (this._marginTopHiddenObject)
                returnvalue = 3; // Gtk.PositionType.BOTTOM;
            else
                returnvalue = null;

            break;
        case 'bottom':
            if (this._marginBottomHiddenObject)
                returnvalue = 2; // Gtk.PositionType.TOP;
            else
                returnvalue = null;

            break;
        case 'center':
            returnvalue = null;
            break;
        case 'bottomRight':
            if (this._marginBottomHiddenObject && this._marginRightHiddenObject) {
                returnvalue = 1; // Gtk.PositionType.LEFT = 0, overRiding with 1 as it works
                break;
            }
            if (this._marginBottomHiddenObject) {
                returnvalue = 2; // Gtk.PositionType.TOP
                break;
            }
            if (this._marginRightHiddenObject) {
                returnvalue = 1; // Gtk.PositionType.LEFT = 0, overRiding with 1 as it works
                break;
            }
            break;
        case 'bottomLeft':
            if (this._marginBottomHiddenObject && this._marginLeftHiddenObject) {
                returnvalue = 1; // Gtk.PositionType.RIGHT
                break;
            }
            if (this._marginBottomHiddenObject) {
                returnvalue = 2; // Gtk.PositionType.TOP
                break;
            }
            if (this._marginLeftHiddenObject) {
                returnvalue = 1; // Gtk.PositionType.RIGHT
                break;
            }
            break;
        case 'topRight':
            if (this._marginTopHiddenObject && this._marginRightHiddenObject) {
                returnvalue = 1; // Gtk.PositionType.LEFT = 0, overRiding with 1 as it works
                break;
            }
            if (this._marginTopHiddenObject) {
                returnvalue = 3; // Gtk.PositionType.BOTTOM
                break;
            }
            if (this._marginRightHiddenObject) {
                returnvalue = 1; // Gtk.PositionType.LEFT = 0, overRiding with 1 as it works
                break;
            }
            break;
        case 'topLeft':
            if (this._marginTopHiddenObject && this._marginLeftHiddenObject) {
                returnvalue = 1; // Gtk.PositionType.RIGHT
                break;
            }
            if (this._marginTopHiddenObject) {
                returnvalue = 3; // Gtk.PositionType.BOTTOM
                break;
            }
            if (this._marginLeftHiddenObject) {
                returnvalue = 1; // Gtk.PositionType.RIGHT
                break;
            }
            break;
        default:
            this.disableIntellihide();
            returnvalue = null;
        }
        return returnvalue;
    }

    disableIntellihide() {
        //* Needs Fixing and testing with X11 *//
        const enableShowInWindowList = `@!${this._x},${this._y};BDF`;
        this._window.set_title(enableShowInWindowList);
        this.showInWindowList = true;
    }

    enableIntellihide() {
        if (this.showInWindowList) {
            this._window.set_title(this._desktopName);
            this.showInWindowList = false;
        }
    }


    setDropDestination(widget) {
        this.gridDropController = new Gtk.DropTargetAsync();
        this.gridDropController.set_actions(Gdk.DragAction.MOVE | Gdk.DragAction.COPY | Gdk.DragAction.ASK);
        const desktopAcceptFormats = Gdk.ContentFormats.new(this.Enums.DndTargetInfo.MIME_TYPES);
        const fileItemAcceptFormats = Gdk.ContentFormats.new([this.Enums.DndTargetInfo.GNOME_ICON_LIST, this.Enums.DndTargetInfo.URI_LIST]);
        const desktopMoveIconsFormat = Gdk.ContentFormats.new([this.Enums.DndTargetInfo.DING_ICON_LIST]);
        const textDropFormat = Gdk.ContentFormats.new([this.Enums.DndTargetInfo.TEXT_PLAIN]);
        const oldNautilusDropFormat = Gdk.ContentFormats.new([this.Enums.DndTargetInfo.GNOME_ICON_LIST]);
        this.gridDropController.set_formats(desktopAcceptFormats);

        let acceptFormat = null;
        let dropData = null;

        this.gridDropController.connect('accept', (actor, drop) => {
            if (drop.get_formats().match(desktopAcceptFormats))
                return true;
            else
                return false;
        });

        this.gridDropController.connect('drag-enter', (actor, drop) => {
            this.localDrag = true;
            drop.status(Gdk.DragAction.COPY | Gdk.DragAction.MOVE | Gdk.DragAction.LINK,
                Gdk.DragAction.MOVE);
            return Gdk.DragAction.MOVE;
        });

        this.gridDropController.connect('drag-motion', (actor, drop, x, y) => {
            let desktopDropZone = false;
            let fileItemDropZone = false;
            let fileItem = this._fileAt(x, y);
            let [X, Y] = this.coordinatesLocalToGlobal(x, y);
            let dropRectangle = new Gdk.Rectangle({x: X, y: Y, width: 1, height: 1});
            let desktopMove = drop.get_formats().match(desktopMoveIconsFormat);
            let filesMove = drop.get_formats().match(fileItemAcceptFormats);

            if (fileItem) {
                if (this.Prefs.showDropPlace)
                    fileItemDropZone = true;
                else if (dropRectangle.intersect(fileItem.iconRectangle)[0] || dropRectangle.intersect(fileItem.labelRectangle)[0])
                    fileItemDropZone = true;
                if (desktopMove && fileItem._hasToRouteDragToGrid())
                    fileItemDropZone = false;
            }
            desktopDropZone = !fileItemDropZone;

            this.receiveMotion(x, y, false);

            if (fileItemDropZone && !fileItem.dropCapable)
                return false;

            if (fileItemDropZone && fileItem.dropCapable) {
                if (!filesMove)
                    return false;

                if (fileItem._fileExtra !== this.Enums.FileType.EXTERNAL_DRIVE)
                    return Gdk.DragAction.MOVE;

                if (fileItem._fileExtra === this.Enums.FileType.EXTERNAL_DRIVE)
                    return Gdk.DragAction.COPY;
            }

            if (desktopDropZone) {
                if (desktopMove) {
                    if (this.Prefs.keepArranged || this.Prefs.keepStacked) {
                        if (this.Prefs.sortSpecialFolders)
                            return false;
                        else if (this._desktopManager.getCurrentSelection().filter(f => !f.isSpecial).length >= 1)
                            return false;
                    }
                }
                return Gdk.DragAction.MOVE;
            }
            return false;
        });

        this.gridDropController.connect('drag-leave', () => {
            this.localDrag = false;
            this.receiveLeave();
        });

        this.gridDropController.connect('drop', (actor, drop, x, y) => {
            const event = {
                'parentWindow': this._window,
                'timestamp': Gdk.CURRENT_TIME,
            };

            let desktopDropZone = false;
            let fileItemDropZone = false;
            let fileItem = this._fileAt(x, y);
            let [X, Y] = this.coordinatesLocalToGlobal(x, y);
            let dropRectangle = new Gdk.Rectangle({x: X, y: Y, width: 1, height: 1});
            let desktopMove = drop.get_formats().match(desktopMoveIconsFormat);
            let filesMove = drop.get_formats().match(fileItemAcceptFormats);
            let oldNautilusMove = drop.get_formats().match(oldNautilusDropFormat);
            let readFormat = Gdk.FileList.$gtype;

            if (fileItem) {
                if (this.Prefs.showDropPlace)
                    fileItemDropZone = true;
                else if (dropRectangle.intersect(fileItem.iconRectangle)[0] || dropRectangle.intersect(fileItem.labelRectangle)[0])
                    fileItemDropZone = true;
                if (desktopMove && fileItem._hasToRouteDragToGrid())
                    fileItemDropZone = false;
            }
            desktopDropZone = !fileItemDropZone;

            let textDrop = drop.get_formats().match(textDropFormat) && !desktopMove && !filesMove;
            if (textDrop) {
                acceptFormat = this.Enums.DndTargetInfo.TEXT_PLAIN;
                readFormat = String.$gtype;
            }

            if (desktopMove)
                acceptFormat = this.Enums.DndTargetInfo.DING_ICON_LIST;

            if (filesMove && !desktopMove) {
                if (oldNautilusMove) {
                    acceptFormat = this.Enums.DndTargetInfo.GNOME_ICON_LIST;
                    readFormat = String.$gtype;
                } else {
                    acceptFormat = this.Enums.DndTargetInfo.URI_LIST;
                    readFormat = String.$gtype;
                }
            }

            let gdkDropAction = drop.get_actions();
            if (!Gdk.DragAction.is_unique(gdkDropAction)) {
                if (this._using_X11 && (gdkDropAction >= (Gdk.DragAction.COPY | Gdk.DragAction.MOVE)))
                    gdkDropAction = Gdk.DragAction.MOVE;
                else if (gdkDropAction > (Gdk.DragAction.COPY | Gdk.DragAction.MOVE))
                    gdkDropAction = Gdk.DragAction.ASK;
            }
            let gdkReturnAction = Gdk.DragAction.COPY;

            if (desktopMove && desktopDropZone && (gdkDropAction === Gdk.DragAction.MOVE)) {
                let [xOrigin, yOrigin] = this._desktopManager.dragItem.getCoordinates().slice(0, 3);
                this._desktopManager.doMoveWithDragAndDrop(xOrigin, yOrigin, X, Y);
                this.receiveLeave();
                drop.finish(gdkDropAction);
                return true;
            }

            try {
                drop.read_value_async(readFormat, GLib.PRIORITY_DEFAULT, null, async (dropactor, result) => {
                    dropData = dropactor.read_value_finish(result);

                    if (!dropData || !acceptFormat) {
                        drop.finish(0);
                        this.receiveLeave();
                        return false;
                    }

                    if (dropData && textDrop) {
                        gdkReturnAction = Gdk.DragAction.COPY;
                        this._desktopManager.onTextDrop(dropData, [X, Y]);
                        drop.finish(gdkReturnAction);
                        this.receiveLeave();
                        return true;
                    }

                    gdkReturnAction = await this._completeDrop(X, Y, x, y, drop, dropData, gdkDropAction, fileItem, acceptFormat, fileItemDropZone, desktopDropZone, desktopMove, filesMove, textDrop, event).catch(e => logError(e));
                    if (gdkReturnAction) {
                        drop.finish(gdkReturnAction);
                        this.receiveLeave();
                        return true;
                    } else {
                        drop.finish(0);
                        this.receiveLeave();
                        return false;
                    }
                });
            } catch (e) {
                logError(e);
                drop.finish(0);
                this.receiveLeave();
            }
            return false;
        });

        widget.add_controller(this.gridDropController);

        this.gridDropControllerMotion = new Gtk.DropControllerMotion();
        this.gridDropControllerMotion.connect('motion', (actor, x, y) => {
            if (!this.gridDropControllerMotion.is_pointer) {
                let fileItem = this._fileAt(x, y);
                let [X, Y] = this.coordinatesLocalToGlobal(x, y);
                let pointerRectangle = new Gdk.Rectangle({x: X, y: Y, width: 1, height: 1});
                if (fileItem && fileItem.dropCapable) {
                    this._desktopManager.unHighLightDropTarget();
                    if (this.Prefs.showDropPlace)
                        fileItem.highLightDropTarget();
                    else if (pointerRectangle.intersect(fileItem.iconRectangle)[0] || pointerRectangle.intersect(fileItem.labelRectangle)[0])
                        fileItem.highLightDropTarget();
                }
                if (fileItem && (fileItem.isDirectory || fileItem.isDrive))
                    this._startSpringLoadedTimer(fileItem);
            } else {
                this._desktopManager.unHighLightDropTarget();
                this._stopSpringLoadedTimer();
            }
        });

        widget.add_controller(this.gridDropControllerMotion);
    }

    async _completeDrop(X, Y, x, y, drop, dropData, gdkDropAction, fileItem, acceptFormat, fileItemDropZone, desktopDropZone, desktopMove, filesMove, textDrop, event) {
        let returnAction = Gdk.DragAction.COPY;
        let localDrop = !!drop.get_drag();
        if (fileItemDropZone && (desktopMove || filesMove)) {
            returnAction = await fileItem.receiveDrop(X, Y, x, y, dropData, acceptFormat, gdkDropAction, localDrop, event, this._desktopManager.dragItem).catch(e => logError(e));
            return returnAction;
        }

        if (desktopDropZone && (desktopMove || filesMove)) {
            returnAction = await this.receiveDrop(x, y, dropData, acceptFormat, gdkDropAction, localDrop, event, this._desktopManager.dragItem).catch(e => logError(e));
            return returnAction;
        }

        // Finally if all above does not work, catchall-
        return false;
    }


    setDragSource(widget) {
        let widgetDragController = Gtk.DragSource.new();
        let clickItem;
        widgetDragController.set_actions(Gdk.DragAction.MOVE | Gdk.DragAction.COPY | Gdk.DragAction.ASK);
        // eslint-disable-next-line consistent-return
        widgetDragController.connect('prepare', (actor, x, y) => {
            let draggedItem = this._fileAt(x, y);
            if (draggedItem && !this._desktopManager.rubberBand) {
                clickItem = draggedItem;
                let [a, b] = this.coordinatesWidgetToWidget(x, y, this._container, clickItem._icon).map(f => Math.floor(f));
                let dragIcon = this._createStackedDragIcon(clickItem);
                widgetDragController.set_icon(dragIcon, a, b);
                clickItem.dragSourceOffset = [a, b];
                this._loadDragData();
                if (this.contentProvider)
                    return this.contentProvider;
            }
        });
        widgetDragController.connect('drag-begin', () => {
            this._desktopManager.onReleaseButton(this);
            this._desktopManager.onDragBegin(clickItem);
        });
        widgetDragController.connect('drag-cancel', async (actor, drag, reason) => {
            if (reason === Gdk.DragCancelReason.NO_TARGET || reason === Gdk.DragCancelReason.ERROR) {
                let gnomedropDetected = await this._desktopManager.gnomeShellDrag?.completeGnomeShellDrop().catch(e => logError(e));
                if (gnomedropDetected)
                    return true;
                else
                    return false;
            } else {
                return false;
            }
        });
        widgetDragController.connect('drag-end', () => {
            this._desktopManager.onDragEnd();
            this._desktopManager.selected(clickItem, this.Enums.Selection.RELEASE);
        });
        widget.add_controller(widgetDragController);
    }

    _loadDragData() {
        this.contentProvider = null;
        let textCoder = new TextEncoder();

        let dingDragData = this._desktopManager.fillDragDataGet(this.Enums.DndTargetInfo.DING_ICON_LIST);
        if (!dingDragData)
            return;

        let dingContentProvider = Gdk.ContentProvider.new_for_bytes(this.Enums.DndTargetInfo.DING_ICON_LIST, textCoder.encode(dingDragData));

        if (this._desktopManager.checkIfSpecialFilesAreSelected()) {
            this.contentProvider = dingContentProvider;
        } else {
            let gnomeDragData = this._desktopManager.fillDragDataGet(this.Enums.DndTargetInfo.GNOME_ICON_LIST);
            let gnomeContentProvider = Gdk.ContentProvider.new_for_bytes(this.Enums.DndTargetInfo.GNOME_ICON_LIST, textCoder.encode(gnomeDragData));
            let textUriListContentProvider = Gdk.ContentProvider.new_for_bytes(this.Enums.DndTargetInfo.URI_LIST, textCoder.encode(dingDragData));
            let textlistContentProvider = Gdk.ContentProvider.new_for_bytes(this.Enums.DndTargetInfo.TEXT_PLAIN, textCoder.encode(dingDragData));
            this.contentProvider = Gdk.ContentProvider.new_union([dingContentProvider, gnomeContentProvider, textUriListContentProvider, textlistContentProvider]);
        }
    }

    // The following code is translated from Nautilus C to Javascript to form the similar stack of items
    _createStackedDragIcon(draggedItem) {
        let  dragIconArray = this._desktopManager.getCurrentSelection(false);
        // eslint-disable-next-line no-nested-ternary
        dragIconArray.sort((a, b) => a.uri === draggedItem.uri ? -1 : b.uri === draggedItem.uri ? 1 : 0);
        dragIconArray = dragIconArray.map(f => f._icon.get_paintable());
        const numberOfIcons = dragIconArray.length;

        const dragIcon = Gtk.Snapshot.new();
        /* A wide shadow for the pile of icons gives a sense of floating. */
        const stackShadow = {color: {red: 0, green: 0, blue: 0, alpha: 0.15}, dx: 0, dy: 2, radius: 10};
        /* A slight shadow swhich makes each icon in the stack look separate. */
        const iconShadow = {color: {red: 0, green: 0, blue: 0, alpha: 0.30}, dx: 0, dy: 1, radius: 1};

        let xOffset = numberOfIcons % 2 === 1 ? 6 : -6;
        let yOffset;
        switch (numberOfIcons) {
        case 1:
            yOffset = 0;
            break;
        case 2:
            yOffset = 10;
            break;
        case 3:
            yOffset = 6;
            break;
        default:
            yOffset = 4;
        }

        dragIcon.translate(new Graphene.Point({x: 10 + (xOffset / 2), y: yOffset * numberOfIcons}));
        let shadow = new Gsk.Shadow(stackShadow);
        dragIcon.push_shadow([shadow]);
        dragIconArray.reverse().forEach(paintableWidget => {
            let w = paintableWidget.get_intrinsic_width();
            let h = paintableWidget.get_intrinsic_height();
            let X = Math.floor((this.Prefs.IconSize - w) / 2);
            let Y = Math.floor((this.Prefs.IconSize - h) / 2);
            dragIcon.translate(new Graphene.Point({x: -xOffset, y: -yOffset}));
            xOffset = -xOffset;
            dragIcon.translate(new Graphene.Point({x: X, y: Y}));
            dragIcon.push_shadow([new Gsk.Shadow(iconShadow)]);
            paintableWidget.snapshot(dragIcon, w, h);
            dragIcon.pop();
            dragIcon.translate(new Graphene.Point({x: -X, y: -Y}));
        });
        dragIcon.pop();
        return dragIcon.to_paintable(null);
    }

    receiveLeave() {
        this._window.queue_draw();
        this._desktopManager.onDragLeave();
    }

    receiveMotion(x, y, global) {
        let X;
        let Y;
        if (!global) {
            x = this._elementWidth * Math.floor(x / this._elementWidth);
            y = this._elementHeight * Math.floor(y / this._elementHeight);
            [X, Y] = this.coordinatesLocalToGlobal(x, y);
        }
        this._desktopManager.onDragMotion(X, Y);
    }

    async receiveDrop(x, y, selection, info, gdkDropAction, localDrop, event, dragItem) {
        x = this._elementWidth * Math.floor(x / this._elementWidth);
        y = this._elementHeight * Math.floor(y / this._elementHeight);
        let [X, Y] = this.coordinatesLocalToGlobal(x, y);
        let returnAction = await this._desktopManager.onDragDataReceived(X, Y, x, y, selection, info, gdkDropAction, localDrop, event, dragItem).catch(e => logError(e));
        return returnAction;
    }

    _startSpringLoadedTimer(fileItem) {
        if (!this.Prefs.openFolderOnDndHover || this.directoryOpenTimer)
            return;
        if (this._desktopManager.dragItem.uri === fileItem.uri)
            return;
        this.directoryOpenTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.Enums.DND_HOVER_TIMEOUT, () => {
            const context = Gdk.Display.get_default().get_app_launch_context();
            context.set_timestamp(Gdk.CURRENT_TIME);
            try {
                Gio.AppInfo.launch_default_for_uri(
                    fileItem.uri, context);
            } catch (e) {
                logError(e, `Error opening ${fileItem.uri} in GNOME Files: ${e.message}`);
            }
            this.directoryOpenTimer = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopSpringLoadedTimer() {
        if (this.directoryOpenTimer)
            GLib.Source.remove(this.directoryOpenTimer);
        this.directoryOpenTimer = 0;
    }

    highLightGridAt(x, y) {
        let selected = this.getGridAt(x, y, false);
        this._selectedList = [selected];
        this._drawDropRectangles();
    }

    unHighLightGrids() {
        this._selectedList = null;
        this._drawDropRectangles();
    }

    _getGridCoordinates(x, y) {
        let placeX = Math.floor(x / this._elementWidth);
        let placeY = Math.floor(y / this._elementHeight);
        placeX = this.DesktopIconsUtil.clamp(placeX, 0, this._maxColumns - 1);
        placeY = this.DesktopIconsUtil.clamp(placeY, 0, this._maxRows - 1);
        return [placeX, placeY];
    }

    gridInUse(x, y) {
        let [placeX, placeY] = this._getGridCoordinates(x, y);
        return !this._isEmptyAt(placeX, placeY);
    }

    getGridLocalCoordinates(x, y) {
        let [column, row] = this._getGridCoordinates(x, y);
        let localX = Math.floor(this._width * column / this._maxColumns);
        let localY = Math.floor(this._height * row / this._maxRows);
        return [localX, localY];
    }

    _fileAt(x, y) {
        let [placeX, placeY] = this._getGridCoordinates(x, y);
        return this._gridStatus[placeY * this._maxColumns + placeX];
    }

    refreshDrag(selectedList, ox, oy) {
        if (selectedList === null) {
            this._selectedList = null;
            this._drawDropRectangles();
            return;
        }
        let newSelectedList = [];
        for (let [x, y] of selectedList) {
            x += this._elementWidth / 2;
            y += this._elementHeight / 2;
            x += ox;
            y += oy;
            let r = this.getGridAt(x, y);
            if (r && !isNaN(r[0]) && !isNaN(r[1]) && (!this.gridInUse(r[0], r[1]) || this._fileAt(r[0], r[1]).isSelected))
                newSelectedList.push(r);
        }
        if (newSelectedList.length === 0) {
            if (this._selectedList !== null) {
                this._selectedList = null;
                this._drawDropRectangles();
            }
            return;
        }
        if (this._selectedList !== null) {
            if ((newSelectedList[0][0] === this._selectedList[0][0]) && (newSelectedList[0][1] === this._selectedList[0][1]))
                return;
        }
        this._selectedList = newSelectedList;
        this._drawDropRectangles();
    }

    _doDrawOnGrid(actor, cr) {
        this._doDrawRubberBand(actor, cr);
        this._doDrawDropRectangles(actor, cr);
    }

    queue_draw() {
        this._drawArea.queue_draw();
    }

    _drawDropRectangles() {
        this._drawArea.queue_draw();
    }

    drawRubberBand() {
        this._drawArea.queue_draw();
    }

    async _doDrawRubberBand(actor, cr) {
        if (!this._desktopManager.rubberBand ||
            !this._desktopManager.selectionRectangle ||
            !this.gridGlobalRectangle.intersect(this._desktopManager.selectionRectangle)[0])
            return;
        const [xInit, yInit] = this.coordinatesGlobalToLocal(this._desktopManager.x1, this._desktopManager.y1);
        const [xFin, yFin] = this.coordinatesGlobalToLocal(this._desktopManager.x2, this._desktopManager.y2);
        const width = xFin - xInit;
        const height = yFin - yInit;
        const fillColor = new Gdk.RGBA({
            red: this._desktopManager.selectColor.red,
            green: this._desktopManager.selectColor.green,
            blue: this._desktopManager.selectColor.blue,
            alpha: 0.3,
        });
        const outlineColor = new Gdk.RGBA({
            red: this._desktopManager.selectColor.red,
            green: this._desktopManager.selectColor.green,
            blue: this._desktopManager.selectColor.blue,
            alpha: 1.0,
        });
        await this._rectangleDraw(xInit, yInit, width, height, cr, fillColor, outlineColor).catch(logError);
    }

    async _doDrawDropRectangles(actor, cr) {
        if (!this.Prefs.showDropPlace || this._selectedList === null)
            return;
        const fillColor = new Gdk.RGBA({
            red: 1.0 - this._desktopManager.selectColor.red,
            green: 1.0 - this._desktopManager.selectColor.green,
            blue: 1.0 - this._desktopManager.selectColor.blue,
            alpha: 0.4,
        });
        const outlineColor = new Gdk.RGBA({
            red: 1.0 - this._desktopManager.selectColor.red,
            green: 1.0 - this._desktopManager.selectColor.green,
            blue: 1.0 - this._desktopManager.selectColor.blue,
            alpha: 1.0,
        });
        const dropRectanglePromises = this._selectedList.map(([x, y]) => {
            return this._rectangleDraw(x, y, this._elementWidth, this._elementHeight, cr, fillColor, outlineColor);
        });
        await Promise.all(dropRectanglePromises).catch(logError);
    }

    _rectangleDraw(x, y, width, height, cr, fillColor, outlineColor) {
        return new Promise(resolve => {
            cr.rectangle(x + 0.5, y + 0.5, width, height);
            Gdk.cairo_set_source_rgba(cr, fillColor);
            cr.fill();
            cr.setLineWidth(0.5);
            cr.rectangle(x + 0.5, y + 0.5, width, height);
            Gdk.cairo_set_source_rgba(cr, outlineColor);
            cr.stroke();
            resolve(true);
        });
    }

    getDistance(x) {
        // Returns the distance to the middle point of this grid from X //
        return Math.pow(x - (this._x + this._windowWidth * this._zoom / 2), 2) + Math.pow(x - (this._y + this._windowHeight * this._zoom / 2), 2);
    }

    isAvailable() {
        let isFree = false;
        for (let element in this._gridStatus) {
            if (!this._gridStatus[element]) {
                isFree = true;
                break;
            }
        }
        return isFree;
    }

    coordinatesGlobalToLocal(X, Y, widget = null) {
        [X, Y] = this.coordinatesGlobalToWindow(X, Y);

        if (!widget)
            widget = this._container;

        let [x, y] = this._window.translate_coordinates(widget, X, Y).slice(1);
        return [x, y];
    }

    coordinatesGlobalToWindow(X, Y) {
        X -= this._x;
        Y -= this._y;
        return [X, Y];
    }

    coordinatesWidgetToWidget(x, y, widget1, widget2) {
        let [X, Y] = widget1.translate_coordinates(widget2, x, y).slice(1);
        return [X, Y];
    }

    coordinatesLocalToWindow(x, y, widget = null) {
        if (!widget)
            widget = this._container;

        let [X, Y] = widget.translate_coordinates(this._window, x, y).slice(1);
        return [X, Y];
    }

    coordinatesLocalToGlobal(x, y, widget = null) {
        let [X, Y] = this.coordinatesLocalToWindow(x, y, widget);
        return [X + this._x, Y + this._y];
    }

    _addFileItemTo(fileItem, column, row, coordinatesAction) {
        if (this._destroying)
            return;

        let localX = Math.floor(this._width * column / this._maxColumns);
        let localY = Math.floor(this._height * row / this._maxRows);
        this._container.put(fileItem.container, localX + elementSpacing, localY + elementSpacing);
        this._setGridUse(column, row, fileItem);
        this._fileItems[fileItem.uri] = [column, row, fileItem];
        let [x, y] = this.coordinatesLocalToGlobal(localX + elementSpacing, localY + elementSpacing);
        fileItem.setCoordinates(x,
            y,
            this._elementWidth - 2 * elementSpacing,
            this._elementHeight - 2 * elementSpacing,
            elementSpacing,
            this);
        /* If this file is new in the Desktop and hasn't yet
         * fixed coordinates, store the new possition to ensure
         * that the next time it will be shown in the same possition.
         * Also store the new possition if it has been moved by the user,
         * and not triggered by a screen change.
         */
        if ((fileItem.savedCoordinates === null) || (coordinatesAction === this.Enums.StoredCoordinates.OVERWRITE))
            fileItem.savedCoordinates = [x, y];
    }

    removeItem(fileItem) {
        if (fileItem.uri in this._fileItems) {
            let [column, row] = this._fileItems[fileItem.uri].slice(0, 3);
            this._setGridUse(column, row, false);
            this._container.remove(fileItem.container);
            delete this._fileItems[fileItem.uri];
        }
    }

    addFileItemCloseTo(fileItem, x, y, coordinatesAction) {
        let addVolumesOpposite = this.Prefs.AddVolumesOpposite;
        let [column, row] = this._getEmptyPlaceClosestTo(
            x,
            y,
            coordinatesAction,
            fileItem.isDrive && addVolumesOpposite
        );
        this._addFileItemTo(fileItem, column, row, coordinatesAction);
    }

    _isEmptyAt(x, y) {
        return this._gridStatus[y * this._maxColumns + x] === false;
    }

    _setGridUse(x, y, inUse) {
        this._gridStatus[y * this._maxColumns + x] = inUse;
    }

    getGridAt(x, y, globalCoordinates = false) {
        if (this.coordinatesBelongToThisGrid(x, y)) {
            [x, y] = this.coordinatesGlobalToLocal(x, y);
            if (globalCoordinates) {
                x = this._elementWidth * Math.floor((x / this._elementWidth) + 0.5);
                y = this._elementHeight * Math.floor((y / this._elementHeight) + 0.5);
                [x, y] = this.coordinatesLocalToGlobal(x, y);
                return [x, y];
            } else {
                return this.getGridLocalCoordinates(x, y);
            }
        } else {
            return null;
        }
    }

    coordinatesBelongToThisGrid(X, Y) {
        let checkRectangle = new Gdk.Rectangle({x: X, y: Y, width: 1, height: 1});
        return this.gridGlobalRectangle.intersect(checkRectangle)[0];
    }

    getGlobaltoLocalRectangle(gdkRectangle) {
        const [X, Y] = this.coordinatesGlobalToLocal(gdkRectangle.x, gdkRectangle.y);
        return new Gdk.Rectangle({x: X, y: Y, width: gdkRectangle.width, height: gdkRectangle.height});
    }

    _getEmptyPlaceClosestTo(x, y, coordinatesAction, reverseHorizontal) {
        [x, y] = this.coordinatesGlobalToLocal(x, y);
        let placeX = Math.floor(x / this._elementWidth);
        let placeY = Math.floor(y / this._elementHeight);

        let cornerInversion = this.Prefs.StartCorner;
        if (reverseHorizontal)
            cornerInversion[0] = !cornerInversion[0];

        placeX = this.DesktopIconsUtil.clamp(placeX, 0, this._maxColumns - 1);
        placeY = this.DesktopIconsUtil.clamp(placeY, 0, this._maxRows - 1);
        if (this._isEmptyAt(placeX, placeY) && (coordinatesAction !== this.Enums.StoredCoordinates.ASSIGN))
            return [placeX, placeY];

        let found = false;
        let resColumn = null;
        let resRow = null;
        let minDistance = Infinity;
        let column, row;
        for (let tmpColumn = 0; tmpColumn < this._maxColumns; tmpColumn++) {
            if (cornerInversion[0])
                column = this._maxColumns - tmpColumn - 1;
            else
                column = tmpColumn;

            for (let tmpRow = 0; tmpRow < this._maxRows; tmpRow++) {
                if (cornerInversion[1])
                    row = this._maxRows - tmpRow - 1;
                else
                    row = tmpRow;

                if (!this._isEmptyAt(column, row))
                    continue;


                let proposedX = column * this._elementWidth;
                let proposedY = row * this._elementHeight;
                if (coordinatesAction === this.Enums.StoredCoordinates.ASSIGN)
                    return [column, row];
                let distance = this.DesktopIconsUtil.distanceBetweenPoints(proposedX, proposedY, x, y);
                if (distance < minDistance) {
                    found = true;
                    minDistance = distance;
                    resColumn = column;
                    resRow = row;
                }
            }
        }

        if (!found)
            throw new Error('Not enough place at monitor');


        return [resColumn, resRow];
    }
};
