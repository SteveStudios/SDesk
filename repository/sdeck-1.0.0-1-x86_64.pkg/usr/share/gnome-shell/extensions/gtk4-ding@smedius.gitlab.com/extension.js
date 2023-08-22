/* DING: Desktop Icons New Generation for GNOME Shell
 *
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
/* exported init, enable, disable */
const { GLib, Gio, Meta, Clutter } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Config = imports.misc.config;
const ByteArray = imports.byteArray;

const Me = ExtensionUtils.getCurrentExtension();
const EmulateX11 = Me.imports.emulateX11WindowType;
const VisibleArea = Me.imports.visibleArea;
const GnomeShellOverride = Me.imports.gnomeShellOverride;
const PromiseUtils = Me.imports.utils.promiseUtils;
const FileUtils = Me.imports.utils.fileUtils;

PromiseUtils._promisify({ keepOriginal: true },
    Gio.DataInputStream.prototype, 'read_line_async', 'read_line_finish_utf8');
PromiseUtils._promisify({ keepOriginal: true },
    Gio.Subprocess.prototype, 'wait_async');

const fileProto = imports.system.version >= 17200
    ? Gio.File.prototype : Gio._LocalFilePrototype;

PromiseUtils._promisify({ keepOriginal: true },
    fileProto, 'enumerate_children_async');
PromiseUtils._promisify({ keepOriginal: true },
    Gio.FileEnumerator.prototype, 'close_async');
PromiseUtils._promisify({ keepOriginal: true },
    Gio.FileEnumerator.prototype, 'next_files_async');

const ifaceXml = `
<node>
  <interface name="com.desktop.dingextension.service">
    <method name="updateDesktopGeometry"/>
    <method name="getDropTargetAppInfoDesktopFile">
      <arg type="ad" direction="in" name="Global Drop Coordinates"/>
      <arg type="s" direction="out" name=".desktop Application File Path or 'null'"/>
    </method>
    <method name="getShellGlobalCoordinates">
        <arg type="ai" direction="out" name="Global pointer Coordinates"/>
    </method>
    <method name="setDragCursor">
    <arg type="s" direction="in" name="Set Shell Cursor"/>
</method>
  </interface>
</node>`;

const ShellDropCursor = {
    DEFAULT: 'default',
    NODROP: 'dndNoDropCursor',
    COPY: 'dndCopyCursor',
    MOVE: 'dndMoveCursor',
};

// This object will contain all the global variables
let data = {};

var DesktopIconsUsableArea = null;
var dingExtensionServiceImplementation = null;
var dingExtensionServiceInterface = null;


/**
 * Inits the Extension
 */
function init() {
    data.isEnabled = false;
    data.launchDesktopId = 0;
    data.currentProcess = null;

    data.GnomeShellOverride = null;
    data.GnomeShellVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

    /* The constructor of the EmulateX11 class only initializes some
     * internal properties, but nothing else. In fact, it has its own
     * enable() and disable() methods. That's why it could have been
     * created here, in init(). But since the rule seems to be NO CLASS
     * CREATION IN INIT UNDER NO CIRCUMSTANCES...
     */
    data.x11Manager = null;
    data.visibleArea = null;

    /* Ensures that there aren't "rogue" processes.
     * This is a safeguard measure for the case of Gnome Shell being
     * relaunched (for example, under X11, with Alt+F2 and R), to kill
     * any old DING instance. That's why it must be here, in init(),
     * and not in enable() or disable() (disable already guarantees that
     * the current instance is killed).
     */
    data.killingProcess = true;
    doKillAllOldDesktopProcesses().catch(e => logError(e)).finally(() => (data.killingProcess = false));
}


/**
 * Enables the extension
 */
function enable() {
    if (!data.GnomeShellOverride)
        data.GnomeShellOverride = new GnomeShellOverride.GnomeShellOverride();
    data.GnomeShellOverride.enable();

    if (!data.x11Manager)
        data.x11Manager = new EmulateX11.EmulateX11WindowType();

    if (!DesktopIconsUsableArea) {
        DesktopIconsUsableArea = new VisibleArea.VisibleArea();
        data.visibleArea = DesktopIconsUsableArea;
    }

    if (!data.synthesizeHover)
        data.synthesizeHover = new SynthesizeHover();

    // If the desktop is still starting up, we wait until it is ready
    if (Main.layoutManager._startingUp) {
        data.startupPreparedId = Main.layoutManager.connect('startup-complete', innerEnable);
    } else {
        data.startupPrepareId = null;
        innerEnable();
    }
}

/**
 * The true code that configures everything and launches the desktop program
 */
function innerEnable() {
    if (data.killingProcess) {
        data.startupProcessKillWaitId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (data.killingProcess)
                return GLib.SOURCE_CONTINUE;

            data.startupProcessKillWaitId = 0;
            innerEnable();
            return GLib.SOURCE_REMOVE;
        });
        return;
    }

    if (data.starupPrepareId) {
        Main.layoutManager.disconnect(data.startupPreparedId);
        data.startupPreparedId = null;
    }

    // under X11 we now need to cheat, so now do all this under wayland as well as X
    data.x11Manager.enable();

    /*
     * If the desktop geometry changes (because a new monitor has been added, for example),
     */
    data.monitorsChangedId = Main.layoutManager.connect('monitors-changed', updateDesktopGeometry);

    /*
     * Any change in the workareas must be detected too, for example if the used size changes.
     */
    data.workareasChangedId = global.display.connect('workareas-changed', updateDesktopGeometry);

    /*
     * This callback allows to detect a change in the working area (like when changing the Scale value)
     */
    data.visibleAreaId = data.visibleArea.connect('updated-usable-area', updateDesktopGeometry);

    data.dbusConnectionId = acquireDBusName();

    data.lockSignalhandlerId = Gio.DBus.session.signal_subscribe(
        'org.gnome.ScreenSaver',
        'org.gnome.ScreenSaver',
        'ActiveChanged',
        '/org/gnome/ScreenSaver',
        null,
        Gio.DBusSignalFlags.NONE,
        onActiveChanged
    );

    data.isEnabled = true;
    if (data.launchDesktopId)
        GLib.source_remove(data.launchDesktopId);

    launchDesktop().catch(e => logError(e));

    data.remoteDingActions = Gio.DBusActionGroup.get(
        Gio.DBus.session,
        'com.desktop.ding',
        '/com/desktop/ding/actions'
    );

    data.remoteGeometryUpdateRequestedId = Gio.DBus.session.signal_subscribe(
        'com.desktop.ding',
        'com.desktop.ding.geometrycontrol',
        'updategeometry',
        '/com/desktop/ding/geometrycontrol',
        null,
        Gio.DBusSignalFlags.NONE,
        updateDesktopGeometry
    );
}

/**
 * Acquire the DBus Name on the Session Bus
 *
 */
function acquireDBusName() {
    let ID = Gio.bus_own_name(
        Gio.BusType.SESSION,
        'com.desktop.dingextension',
        Gio.BusNameOwnerFlags.NONE,
        onBusAcquired.bind(dingExtensionServiceImplementation),
        (connection, name) => {
            log(`${name} DBus Name Acquired`);
            data.dbusConnectionName = name;
        },
        (connection, name) => {
            log(`${name} DBus and Name Lost`);
            data.dbusConnectionName = null;
        }
    );
    return ID;
}


/**
 * Start stop the  Dbus Service with screen locks and unlocks
 *
 * @param {GObject} connection the Dbus Connection
 * @param {string} sender the numeric Dbus Sender address
 * @param {string} path the Dbus Sender path
 * @param {string} iface the Sender Dbus interface
 * @param {string} signal the signal name
 * @param {GLib.variant} params the GLib.variant with parameters
 */
function onActiveChanged(connection, sender, path, iface, signal, params) {
    const value = params.get_child_value(0);
    const locked = value.get_boolean();
    if (locked) {
        if (data.dbusConnectionId) {
            Gio.bus_unown_name(data.dbusConnectionId);
            data.dbusConnectionId = 0;
            log(`${data.dbusConnectionName} DBus Name Relenquished`);
        }
    } else if (!data.dbusConnectionId || !data.dbusConnectionName) {
        data.dbusConnectionId = acquireDBusName();
    }
}

/**
 * Start the Dbus Service
 *
 * @param {GObject} connection the Dbus Connection
 *
 */
function onBusAcquired(connection) {
    if (data.dbusConnectionName)
        return;
    dingExtensionServiceImplementation = new DingExtensionService();
    dingExtensionServiceInterface = Gio.DBusExportedObject.wrapJSObject(ifaceXml,
        dingExtensionServiceImplementation);
    dingExtensionServiceInterface.export(connection, '/com/desktop/dingextension/service');
}
/**
 * Kills the current desktop program
 */
function killCurrentProcess() {
    if (data.launchDesktopId) {
        GLib.source_remove(data.launchDesktopId);
        data.launchDesktopId = 0;
    }

    // kill the desktop program. It will be reloaded automatically.
    if (data.currentProcess && data.currentProcess.subprocess) {
        data.currentProcess.cancellable.cancel();
        data.currentProcess.subprocess.send_signal(15);
    }
    data.currentProcess = null;
    data.x11Manager.set_wayland_client(null);
}

/**
 * Disables the extension. Under Gnome 42 the extension runs with the session mode 'unlock-dialog'.
 * This allows the extension to keep running when the lock screen comes on. The advantage is that
 * the Gtk4 program that is spawned by this extension keep running, rendering all the file icons
 * on the desktop. When the user logs back in the desktop is already rendered and running, the
 * desktop program does not need to be first killed on the lock-screen and then launced again on
 * unlock.
 * If disable is called, it explictly kill the desktop program. This will hapen on log out.
 */
function disable() {
    DesktopIconsUsableArea = null;
    data.isEnabled = false;
    killCurrentProcess();
    data.GnomeShellOverride.disable();
    data.x11Manager.disable();
    data.visibleArea.disable();
    data.synthesizeHover.disable();

    if (data.startupProcessKillWaitId) {
        GLib.source_remove(data.startupProcessKillWaitId);
        data.startupProcessKillWaitId = 0;
    }
    if (data.dbusConnectionId) {
        Gio.bus_unown_name(data.dbusConnectionId);
        data.dbusConnectionId = 0;
    }
    // disconnect signals only if connected
    if (data.lockSignalhandlerId) {
        Gio.DBus.session.signal_unsubscribe(data.lockSignalhandlerId);
        data.lockSignalhandlerId = 0;
    }
    if (data.remoteGeometryUpdateRequestedId) {
        Gio.DBus.session.signal_unsubscribe(data.remoteGeometryUpdateRequestedId);
        data.remoteGeometryUpdateRequestedId = 0;
    }
    if (data.visibleAreaId) {
        data.visibleArea.disconnect(data.visibleAreaId);
        data.visibleAreaId = 0;
    }
    if (data.startupPreparedId) {
        Main.layoutManager.disconnect(data.startupPreparedId);
        data.startupPreparedId = 0;
    }
    if (data.monitorsChangedId) {
        Main.layoutManager.disconnect(data.monitorsChangedId);
        data.monitorsChangedId = 0;
    }
    if (data.workareasChangedId) {
        global.display.disconnect(data.workareasChangedId);
        data.workareasChangedId = 0;
    }
}

/**
 * Sends updated geometry data to the DING desktop program over DBus
 */
function updateDesktopGeometry() {
    if (data.remoteDingActions && (Main.layoutManager.monitors.length !== 0))
        data.remoteDingActions.activate_action('updateGridWindows', getDesktopGeometry());
}

/**
 * Gets current desktop Geometry from visibleArea.js
 */
function getDesktopGeometry() {
    let desktopList = [];
    let ws = global.workspace_manager.get_workspace_by_index(0);
    for (let monitorIndex = 0; monitorIndex < Main.layoutManager.monitors.length; monitorIndex++) {
        let area = data.visibleArea.getMonitorGeometry(ws, monitorIndex);
        let desktopListElement = new GLib.Variant('a{sd}', {
            'x': area.x,
            'y': area.y,
            'width': area.width,
            'height': area.height,
            'zoom': area.scale,
            'marginTop': area.marginTop,
            'marginBottom': area.marginBottom,
            'marginLeft': area.marginLeft,
            'marginRight': area.marginRight,
            monitorIndex,
            'primaryMonitor': Main.layoutManager.primaryIndex,
        });
        desktopList.push(desktopListElement);
    }
    return new GLib.Variant('av', desktopList);
}

/**
 * This function checks all the processes in the system and kills those
 * that are a desktop manager from the current user (but not others).
 * This allows to avoid having several ones in case gnome shell resets,
 * or other odd cases. It requires the /proc virtual filesystem, but
 * doesn't fail if it doesn't exist.
 */
async function doKillAllOldDesktopProcesses() {
    const procFolder = Gio.File.new_for_path('/proc');
    const processes = await FileUtils.enumerateDir(procFolder);
    const thisPath = `gjs ${GLib.build_filenamev([
        ExtensionUtils.getCurrentExtension().path,
        'app',
        'ding.js',
    ])}`;

    const killPromises = processes.map(async info => {
        const filename = info.get_name();
        const processPath = GLib.build_filenamev(['/proc', filename, 'cmdline']);
        const processUser = Gio.File.new_for_path(processPath);

        try {
            const [binaryData] = await processUser.load_bytes_async_promise(null);
            const readData = binaryData.get_data();
            let contents = '';

            for (let i = 0; i < readData.length; i++) {
                if (readData[i] < 32)
                    contents += ' ';
                else
                    contents += String.fromCharCode(readData[i]);
            }

            if (contents.startsWith(thisPath)) {
                let proc = new Gio.Subprocess({ argv: ['/bin/kill', filename] });
                proc.init(null);
                print(`Killing old DING process ${filename}`);
                await proc.wait_async_promise(null);
            }
        } catch (e) {

        }
    });

    await Promise.all(killPromises);
}

/**
 *
 * @param {integer} reloadTime Relaunch time after crash in ms
 */
function doRelaunch(reloadTime) {
    data.currentProcess = null;
    data.x11Manager.set_wayland_client(null);
    if (data.isEnabled) {
        if (data.launchDesktopId)
            GLib.source_remove(data.launchDesktopId);

        data.launchDesktopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, reloadTime, () => {
            data.launchDesktopId = 0;
            launchDesktop().catch(e => logError(e));
            return false;
        });
    }
}

/**
 * Launches the desktop program, passing to it the current desktop geometry for each monitor
 * and the path where it is stored. It also monitors it, to relaunch it in case it dies or is
 * killed. Finally, it reads STDOUT and STDERR and redirects them to the journal, to help to
 * debug it.
 */
async function launchDesktop() {
    global.log('Launching Gtk4-DING process');
    let argv = [];
    argv.push(GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'app', 'ding.js']));
    // Specify that it must work as true desktop
    argv.push('-E');
    // The path. Allows the program to find translations, settings and modules.
    argv.push('-P');
    argv.push(ExtensionUtils.getCurrentExtension().path);
    // The current Gnome Shell Version for correct operation of clipboard with Gtk4.
    argv.push('-V');
    argv.push(`${data.GnomeShellVersion}`);

    data.currentProcess = new LaunchSubprocess(0, 'Gtk4-DING');
    data.currentProcess.set_cwd(GLib.get_home_dir());
    data.x11Manager.set_wayland_client(data.currentProcess);

    const launchTime = GLib.get_monotonic_time();
    let subprocess;

    try {
        subprocess = await data.currentProcess.spawnv(argv);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
            logError(e, `Error while trying to launch DING process: ${e.message}`);
            doRelaunch(1000);
        }
        return;
    }

    /*
     * If the desktop process dies, wait 100ms and relaunch it, unless the exit status is different than
     * zero, in which case it will wait one second. This is done this way to avoid relaunching the desktop
     * too fast if it has a bug that makes it fail continuously, avoiding filling the journal too fast.
     */
    const delta = GLib.get_monotonic_time() - launchTime;
    let reloadTime;
    if (delta < 1000000) {
        // If the process is dying over and over again, ensure that it isn't respawn faster than once per second
        reloadTime = 1000;
    } else {
        // but if the process just died after having run for at least one second, reload it ASAP
        reloadTime = 1;
    }

    if (!data.currentProcess || subprocess !== data.currentProcess.subprocess)
        return;


    if (subprocess.get_if_exited())
        subprocess.get_exit_status();

    doRelaunch(reloadTime);
}

/**
 * This class encapsulates the code to launch a subprocess that can detect whether a window belongs to it
 * It only accepts to do it under Wayland, because under X11 there is no need to do these tricks
 *
 * It is compatible with https://gitlab.gnome.org/GNOME/mutter/merge_requests/754 to simplify the code
 *
 * @param {int} flags Flags for the SubprocessLauncher class
 * @param {string} process_id An string id for the debug output
 */
var LaunchSubprocess = class {
    constructor(flags, processId) {
        this._processID = processId;
        this._launcher = new Gio.SubprocessLauncher({ flags: flags | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE });
        if (Meta.is_wayland_compositor()) {
            try {
                this._waylandClient = Meta.WaylandClient.new(this._launcher);
            } catch (e) {
                this._waylandClient = Meta.WaylandClient.new(global.context, this._launcher);
            }

            if (Config.PACKAGE_VERSION === '3.38.0') {
                // workaround for bug in 3.38.0
                this._launcher.ref();
            }
        }
        this.subprocess = null;
        this.process_running = false;
    }

    async spawnv(argv) {
        try {
            if (Meta.is_wayland_compositor())
                this.subprocess = this._waylandClient.spawnv(global.display, argv);
            else
                this.subprocess = this._launcher.spawnv(argv);
        } catch (e) {
            this.subprocess = null;
            throw e;
        }

        if (this.cancellable)
            this.cancellable.cancel();

        const cancellable = new Gio.Cancellable();
        this.cancellable = cancellable;

        // This is for GLib 2.68 or greater
        if (this._launcher.close)
            this._launcher.close();

        this._launcher = null;

        /*
         * It reads STDOUT and STDERR and sends it to the journal using global.log(). This allows to
         * have any error from the desktop app in the same journal than other extensions. Every line from
         * the desktop program is prepended with the "process_id" parameter sent in the constructor.
         */
        const dataInputStream = Gio.DataInputStream.new(this.subprocess.get_stdout_pipe());
        this.readOutput(dataInputStream, cancellable).catch(e => logError(e));

        try {
            this.process_running = true;
            await this.subprocess.wait_async_promise(cancellable);
        } finally {
            cancellable.cancel();
            this.process_running = false;

            if (this.cancellable === cancellable)
                this.cancellable = null;
        }
        return this.subprocess;
    }

    set_cwd(cwd) {
        this._launcher.set_cwd(cwd);
    }

    async readOutput(dataInputStream, cancellable) {
        try {
            const [output, length] = await dataInputStream.read_line_async_promise(
                GLib.PRIORITY_DEFAULT, cancellable);
            if (length)
                print(`${this._processID}: ${ByteArray.toString(output)}`);
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;

            logError(e, `${this._processID}_Error`);
        }

        await this.readOutput(dataInputStream, cancellable);
    }

    /**
     * Queries whether the passed window belongs to the launched subprocess or not.
     *
     * @param {MetaWindow} window The window to check.
     */
    query_window_belongs_to(window) {
        if (!Meta.is_wayland_compositor())
            return false;

        if (!this.process_running)
            return false;

        try {
            return this._waylandClient.owns_window(window);
        } catch (e) {
            return false;
        }
    }

    query_pid_of_program() {
        if (!this.process_running)
            return false;

        return this.subprocess.get_identifier();
    }

    show_in_window_list(window) {
        if (Meta.is_wayland_compositor() && this.process_running)
            this._waylandClient.show_in_window_list(window);
    }

    hide_from_window_list(window) {
        if (Meta.is_wayland_compositor() && this.process_running)
            this._waylandClient.hide_from_window_list(window);
    }
};

/**
 * This class implements the Dbus Services Provided for the extension
 */
var DingExtensionService = class {
    updateDesktopGeometry() {
        updateDesktopGeometry();
    }

    getDropTargetAppInfoDesktopFile([dropX, dropY]) {
        let droptarget = null;
        let actor = null;
        if (!dropX && !dropY)
            [dropX, dropY] = global.get_pointer().slice(0, 2);
        actor = global.get_stage().get_actor_at_pos(Clutter.PickMode.ALL, dropX, dropY);
        let i = 0;
        let checkactor;

        while (actor && (i < 10)) {
            if (actor._delegate)
                checkactor = actor._delegate;
            else
                checkactor = actor;

            if (checkactor?.app?.appInfo?.get_filename()) {
                droptarget = checkactor.app.appInfo.get_filename();
                break;
            }

            if (checkactor?.location?.get_uri()) {
                droptarget = checkactor.location.get_uri();
                break;
            }

            i += 1;
            actor = actor.get_parent();
        }

        if (droptarget) {
            data.synthesizeHover.hoverOver(checkactor);
            return droptarget;
        } else {
            return 'null';
        }
    }

    setDragCursor(cursor) {
        switch (cursor) {
        case ShellDropCursor.MOVE:
            global.display.set_cursor(Meta.Cursor.DND_MOVE);
            break;
        case ShellDropCursor.COPY:
            global.display.set_cursor(Meta.Cursor.DND_COPY);
            break;
        case ShellDropCursor.NODROP:
            global.display.set_cursor(Meta.Cursor.DND_UNSUPPORTED_TARGET);
            break;
        default:
            global.display.set_cursor(Meta.Cursor.DEFAULT);
        }
    }

    getShellGlobalCoordinates() {
        let x = global.get_pointer();
        return x;
    }
};

/** This class simulates a hover on the Dock so thet the dock app items
 * can be visible and scroll automatically on drops.
 */
var SynthesizeHover = class {
    constructor() {
        this._hoveredActor = null;
        this._hoverTimeoutID = 0;
    }

    disable() {
        this._cancelCurrentTimer();
        if (this._hoveredActor)
            this._hoveredActor.set_hover(false);
        this._hoveredActor = null;
    }

    hoverOver(newactor) {
        if (newactor == this._hoveredActor) {
            this._resetHoverTimer();
            return;
        }
        if (this._hoveredActor)
            this._hoveredActor.set_hover(false);
        this._cancelCurrentTimer();
        this._hoveredActor = newactor;
        this._hoveredActor.sync_hover();
        this._setNewHoverTimer(this._hoveredActor);
    }

    _resetHoverTimer() {
        this._cancelCurrentTimer();
        this._setNewHoverTimer(this._hoveredActor);
    }

    _cancelCurrentTimer() {
        if (this._hoverTimeoutID)
            GLib.source_remove(this._hoverTimeoutID);
        this._hoverTimeoutID = 0;
    }

    _setNewHoverTimer(actor) {
        this._hoverTimeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 750, () => {
            actor.set_hover(false);
            this._hoverTimeoutID = 0;
            return false;
        });
    }
};
