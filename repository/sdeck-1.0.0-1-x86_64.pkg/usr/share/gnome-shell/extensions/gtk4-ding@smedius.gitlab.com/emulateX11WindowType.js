/* Emulate X11WindowType
 *
 * Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2020 Sergio Costas (rastersoft@gmail.com)
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
/* exported EmulateX11WindowType */
const { GLib, Gio, Meta, Clutter } = imports.gi;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const AppFavorites = imports.ui.appFavorites;

class ManageWindow {
    /* This class is added to each managed window, and it's used to
       make it behave like an X11 Desktop window.

       Trusted windows will set in the title the characters @!, followed
       by the coordinates where to put the window separated by a colon, and
       ended in semicolon. After that, it can have one or more of these letters-

       * B : put and always keep this window at the bottom of the stack of windows on screen
       * T : put and always keep this window at the top of the stack of windows the screen
       * D : show this window in all desktops
       * H : hide this window from window list

       Using the title is generally not a problem because the desktop windows
       do not have a title. But some other windows may have and still need to
       set a title and use this class, so adding a single blank space at the end of the
       title is equivalent to @!H, and having two blank spaces at the end of the
       title is equivalent to @!HTD. This allows use of these flags for decorated or titled windows.
    */

    constructor(window, waylandClient, changedStatusCB) {
        this._isX11 = !Meta.is_wayland_compositor();
        this._waylandClient = waylandClient;
        this._window = window;
        this._signalIDs = [];
        this._onIdleChangedStatusCallback = changedStatusCB;

        this._signalIDs.push(window.connect_after('raised', () => {
            if (this._keepAtBottom && !this._keepAtTop)
                this._window.lower();
        }));

        this._signalIDs.push(window.connect('position-changed', () => {
            if (this._fixed && (this._x !== null) && (this._y !== null)) {
                this._window.move_frame(true, this._x, this._y);
                if (this._window.fullscreen)
                    this._window.unmake_fullscreen();
            }
        }));

        this._signalIDs.push(window.connect('notify::title', () => {
            this._parseTitle();
        }));

        this._signalIDs.push(window.connect('notify::above', () => {
            if (this._keepAtBottom && this._window.above)
                this._window.unmake_above();
        }));

        this._signalIDs.push(window.connect('notify::minimized', () => {
            this._window.unminimize();
        }));

        this._workSpaceSwitchID = global.window_manager.connect('switch-workspace',
            this._onWorkSpaceChanged.bind(this)
        );

        /* If a window is lowered with shortcuts, detect and fix DING window */
        this._restackedID = global.display.connect('restacked',
            this._syncToBottomOfStack.bind(this)
        );

        this._parseTitle();
    }

    disconnect() {
        for (let signalID of this._signalIDs) {
            if (signalID)
                this._window.disconnect(signalID);
        }

        if (this._workSpaceSwitchID)
            global.window_manager.disconnect(this._workSpaceSwitchID);

        if (this._restackedID)
            global.display.disconnect(this._restackedID);

        if (this._keepAtTop)
            this._window.unmake_above();

        this._window = null;
        this._waylandClient = null;
    }

    set_wayland_client(client) {
        this._waylandClient = client;
    }

    _parseTitle() {
        this._x = null;
        this._y = null;
        this._keepAtBottom = false;
        let keepAtTop = this._keepAtTop;
        this._keepAtTop = false;
        this._showInAllDesktops = false;
        this._hideFromWindowList = false;
        this._fixed = false;
        let title = this._window.get_title();
        if (title !== null) {
            if ((title.length > 0) && (title[title.length - 1] === ' ')) {
                if ((title.length > 1) && (title[title.length - 2] === ' '))
                    title = '@!HTD';
                else
                    title = '@!H';
            }
            let pos = title.search('@!');
            if (pos !== -1) {
                let pos2 = title.search(';', pos);
                let coords;
                if (pos2 !== -1)
                    coords = title.substring(pos + 2, pos2).trim().split(',');
                else
                    coords = title.substring(pos + 2).trim().split(',');

                try {
                    this._x = parseInt(coords[0]);
                    this._y = parseInt(coords[1]);
                } catch (e) {
                    global.log(`Exception ${e.message}.\n${e.stack}`);
                }
                try {
                    let extraChars = title.substring(pos + 2).trim().toUpperCase();
                    for (let char of extraChars) {
                        switch (char) {
                        case 'B':
                            this._keepAtBottom = true;
                            this._window.get_window_type = function () {
                                return Meta.WindowType.DESKTOP;
                            };
                            this._window.stick();
                            this._keepAtTop = false;
                            break;
                        case 'T':
                            this._keepAtTop = true;
                            this._keepAtBottom = false;
                            break;
                        case 'D':
                            this._showInAllDesktops = true;
                            break;
                        case 'H':
                            this._hideFromWindowList = true;
                            break;
                        case 'F':
                            this._fixed = true;
                            break;
                        }
                    }
                } catch (e) {
                    global.log(`Exception ${e.message}.\n${e.stack}`);
                }
            }
            if (this._fixed && (this._x !== null) && (this._y !== null))
                this._window.move_frame(true, this._x, this._y);

            if (!this._isX11 && this._waylandClient) {
                if (this._hideFromWindowList)
                    this._waylandClient.hide_from_window_list(this._window);
                else
                    this._waylandClient.show_in_window_list(this._window);
            }
            if (this._keepAtTop !== keepAtTop) {
                if (this._keepAtTop)
                    this._window.make_above();
                else
                    this._window.unmake_above();
            }
            if (this._keepAtBottom)
                this._window.lower();

            let moveDesktopWindowToBottom = true;
            let activateTopWindowOnWorkspace = true;
            this._onIdleChangedStatusCallback({ moveDesktopWindowToBottom, activateTopWindowOnWorkspace});
        }
    }

    _onWorkSpaceChanged() {
        this._onIdleActivateTopWindowOnActiveWorkspace();
    }

    _onIdleActivateTopWindowOnActiveWorkspace() {
        let activateTopWindowOnWorkspace = true;
        this._onIdleChangedStatusCallback({ activateTopWindowOnWorkspace });
    }

    _syncToBottomOfStack() {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, global.workspace_manager.get_active_workspace());
        windows = global.display.sort_windows_by_stacking(windows);
        if (windows.length > 1 && !windows[0].customJS_ding)
            this._moveDesktopWindowToBottom();
    }

    _moveDesktopWindowToBottom() {
        if (this._window.fullscreen)
            this._window.unmake_fullscreen();

        if (this._keepAtBottom)
            this._window.lower();
    }

    get hideFromWindowList() {
        return this._hideFromWindowList;
    }

    get keepAtBottom() {
        return this._keepAtBottom;
    }
}

var EmulateX11WindowType = class {
    /*
     This class does all the heavy lifting for emulating WindowType.
     Just make one instance of it, call enable(), and whenever a window
     that you want to give "superpowers" is mapped, add it with the
     "addWindowManagedCustomJS_ding" method. That's all.
     */
    constructor() {
        this._isX11 = !Meta.is_wayland_compositor();
        this._windowList = null;
        this._overviewHiding = true;
        this._waylandClient = null;
    }

    set_wayland_client(client) {
        this._waylandClient = client;
        for (let window of this._windowList) {
            if (window.customJS_ding)
                window.customJS_ding.set_wayland_client(this._waylandClient);
        }
    }

    enable() {
        if (!this._windowList)
            this._windowList = new Set();

        this._idMap = global.window_manager.connect_after('map', (obj, windowActor) => {
            let window = windowActor.get_meta_window();
            if (this._waylandClient && this._waylandClient.query_window_belongs_to(window))
                this._addWindowManagedCustomJS_ding(window, windowActor);

            if (this._isX11) {
                let appid = window.get_gtk_application_id();
                let windowpid = window.get_pid();
                let mypid = parseInt(this._waylandClient.query_pid_of_program());
                if ((appid === 'com.desktop.ding') && (windowpid === mypid))
                    this._addWindowManagedCustomJS_ding(window, windowActor);
            }
        });

        this._idDestroy = global.window_manager.connect_after('destroy', (wm, windowActor) => {
            // if a window is closed, ensure that the desktop doesn't receive the focus
            let window = windowActor.get_meta_window();
            if (window && (window.get_window_type() >= Meta.WindowType.DROPDOWN_MENU))
                return;

            this.onIdleReStackActivteWindows({ activateTopWindowOnWorkspace: true });
        });

        /* But in Overview mode it is paramount to not change the workspace to emulate
           "stick", or the windows will appear
         */
        this._showingId = Main.overview.connect('showing', () => {
            this._overviewHiding = false;
        });

        this._hidingId = Main.overview.connect('hiding', () => {
            this._overviewHiding = true;
            this.onIdleReStackActivteWindows({ activateTopWindowOnWorkspace: true });
        });
    }

    disable() {
        if (this._activate_window_ID) {
            GLib.source_remove(this._activate_window_ID);
            this._activate_window_ID = null;
        }
        for (let window of this._windowList)
            this._clearWindow(window);

        this._windowList.clear();
        this._windowList = null;

        // disconnect signals
        if (this._idMap) {
            global.window_manager.disconnect(this._idMap);
            this._idMap = null;
        }
        if (this._idDestroy) {
            global.window_manager.disconnect(this._idDestroy);
            this._idDestroy = null;
        }
        if (this._showingId) {
            Main.overview.disconnect(this._showingId);
            this._showingId = null;
        }
        if (this._hidingId) {
            Main.overview.disconnect(this._hidingId);
            this._hidingId = null;
        }
    }

    _addWindowManagedCustomJS_ding(window, windowActor) {
        if (window.get_meta_window) { // it is a MetaWindowActor
            window = window.get_meta_window();
        }

        if (this._windowList.has(window))
            return;

        window.customJS_ding = new ManageWindow(window, this._waylandClient, this.onIdleReStackActivteWindows.bind(this));
        window.actor = windowActor;
        windowActor._delegate = new HandleDragActors(windowActor);
        this._windowList.add(window);
        window.customJS_ding.unmanagedID = window.connect('unmanaged', win => {
            this._clearWindow(win);
            this._windowList.delete(window);
        });
    }

    _clearWindow(window) {
        window.disconnect(window.customJS_ding.unmanagedID);
        window.customJS_ding.disconnect();
        window.customJS_ding = null;
        window.actor._delegate = null;
        window.actor = null;
    }

    _activateTopWindowOnActiveWorkspace() {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL, global.workspace_manager.get_active_workspace());
        windows = global.display.sort_windows_by_stacking(windows);
        if (windows.length) {
            let topWindow = windows[windows.length - 1];
            topWindow.focus(Clutter.CURRENT_TIME);
        }
    }

    _moveDesktopWindowToBottom() {
        for (let window of this._windowList)
            window.customJS_ding._moveDesktopWindowToBottom();
    }

    onIdleReStackActivteWindows(action = { activateTopWindowOnWorkspace: true }) {
        if (!this._activate_window_ID) {
            this._activate_window_ID = GLib.idle_add(GLib.PRIORITY_LOW, () => {
                if (this._overviewHiding) {
                    if (action.moveDesktopWindowToBottom)
                        this._moveDesktopWindowToBottom();

                    if (action.activateTopWindowOnWorkspace)
                        this._activateTopWindowOnActiveWorkspace();
                }
                this._activate_window_ID = null;
                return GLib.SOURCE_REMOVE;
            });
        }
    }
};

class HandleDragActors {
    /* This class is added to each managed windowActor, and it's used to
       make it behave like a shell Actor that can accept drops from Gnome Shell dnd.
    */

    constructor(windowActor) {
        this.windowActor = windowActor;
        this.remoteDingActions = Gio.DBusActionGroup.get(
            Gio.DBus.session,
            'com.desktop.ding',
            '/com/desktop/ding/actions'
        );
    }

    _getModifierKeys() {
        let [, , state] = global.get_pointer();
        state &= Clutter.ModifierType.MODIFIER_MASK;
        this.isControl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;
        this.isShift = (state & Clutter.ModifierType.SHIFT_MASK) !== 0;
    }

    handleDragOver(source) {
        if ((source.app ?? null) === null)
            return DND.DragMotionResult.NO_DROP;
        this._getModifierKeys();
        if (this.isShift) {
            global.display.set_cursor(Meta.Cursor.DND_COPY);
            return DND.DragMotionResult.COPY_DROP;
        }
        if (this.isControl) {
            global.display.set_cursor(Meta.Cursor.DND_MOVE);
            return DND.DragMotionResult.MOVE_DROP;
        }
        return DND.DragMotionResult.CONTINUE;
    }

    acceptDrop(source, actor, x, y) {
        if ((source.app ?? null) === null)
            return false;

        let appFavorites = AppFavorites.getAppFavorites();
        let sourceAppId = source.app.get_id();
        let sourceAppPath = source.app.appInfo.get_filename();
        let appIsFavorite = appFavorites.isFavorite(sourceAppId);
        this._getModifierKeys();
        if (appIsFavorite && !this.isShift)
            appFavorites.removeFavorite(sourceAppId);
        if (sourceAppPath && (this.isControl || this.isShift)) {
            this.remoteDingActions.activate_action('createDesktopShortcut',
                new GLib.Variant('a{sv}', {
                    uri: GLib.Variant.new_string(`file://${sourceAppPath}`),
                    X: new GLib.Variant('i', parseInt(x)),
                    Y: new GLib.Variant('i', parseInt(y)),
                })
            );
        }
        appFavorites.emit('changed');
        return true;
    }
}
