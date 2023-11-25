/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Gtk4 Port Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 * SwitcherooControl code based on code original from Marsch84
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
import {Gtk, Gdk, Gio, GLib} from '../dependencies/gi.js';
import * as DesktopIconItem from './desktopIconItem.js';
import {_} from '../dependencies/gettext.js';

export {FileItem};

const Signals = imports.signals;

const FileItem = class extends DesktopIconItem.DesktopIconItem {
    constructor(desktopManager, file, fileInfo, fileExtra, custom) {
        super(desktopManager, fileExtra);
        this.DBusUtils = desktopManager.DBusUtils;
        this.PromiseUtils = desktopManager.PromiseUtils;
        this._fileInfo = fileInfo;
        this._custom = custom;
        this._isSpecial = this._fileExtra !== this.Enums.FileType.NONE;
        this._file = file;
        this.isStackTop = false;
        this.stackUnique = false;

        if (imports.system.version < 17200 &&
            this._file.constructor.prototype !== Gio._LocalFilePrototype) {
            /* Older gjs may need specific implementations for special files */
            this.PromiseUtils._promisify({},
                this._file.constructor.prototype, 'query_info_async');
        }

        if (this._custom) {
            /* gjs doesn't handle well some virtual implementations */
            this.PromiseUtils._promisify({}, this._custom.constructor.prototype,
                'eject_with_operation');
            this.PromiseUtils._promisify({}, this._custom.constructor.prototype,
                'unmount_with_operation');
        }

        this._savedCoordinates = this._readCoordinatesFromAttribute(fileInfo, 'metadata::nautilus-icon-position');
        this._dropCoordinates = this._readCoordinatesFromAttribute(fileInfo, 'metadata::nautilus-drop-position');

        this._createIconActor();

        /* Set the metadata */
        this._updateMetadataFromFileInfo(fileInfo);

        if (this._attributeCanExecute && !this._isValidDesktopFile)
            this._execLine = this.file.get_path();
        else
            this._execLine = null;


        if (this.isTrash) {
            // if this icon is the trash, monitor the state of the directory to update the icon
            this._monitorTrash();
        } else {
            this._monitorTrashId = 0;
        }

        this._updateName();
        if (this._dropCoordinates)
            this.setSelected();
    }

    /** *********************
     * Destroyers *
     ***********************/

    _destroy() {
        super._destroy();
        /* Trash */
        if (this._monitorTrashId) {
            this._monitorTrashDir.disconnect(this._monitorTrashId);
            this._monitorTrashDir.cancel();
            this._monitorTrashId = 0;
        }
        if (this._symlinkFileMonitorId) {
            this._symlinkFileMonitor.disconnect(this._symlinkFileMonitorId);
            this._symlinkFileMonitor.cancel();
            this._symlinkFileMonitorId = 0;
        }

        if (this._queryFileInfoCancellable)
            this._queryFileInfoCancellable.cancel();

        if (this._queryTrashInfoCancellable)
            this._queryTrashInfoCancellable.cancel();

        if (this._umountCancellable)
            this._umountCancellable.cancel();

        if (this._ejectCancellable)
            this._ejectCancellable.cancel();

        if (this._savedCoordinatesCancellable)
            this._savedCoordinatesCancellable.cancel();

        if (this._dropCoordinatesCancellable)
            this._dropCoordinatesCancellable.cancel();

        if (this._scheduleTrashRefreshId) {
            GLib.source_remove(this._scheduleTrashRefreshId);
            this._scheduleTrashRefreshId = 0;
        }
        /* Metadata */
        if (this._setMetadataTrustedCancellable)
            this._setMetadataTrustedCancellable.cancel();
    }

    /** *********************
     * Creators *
     ***********************/

    _getVisibleName() {
        if (this._fileExtra === this.Enums.FileType.EXTERNAL_DRIVE)
            return this._custom.get_name();
        else
            return this._fileInfo.get_display_name();
    }

    _setFileName(text) {
        if (this._fileExtra === this.Enums.FileType.USER_DIRECTORY_HOME) {
            // TRANSLATORS: "Home" is the text that will be shown in the user's personal folder
            text = _('Home');
        }
        this._setLabelName(text);
    }

    _readCoordinatesFromAttribute(fileInfo, attribute) {
        let savedCoordinates = fileInfo.get_attribute_as_string(attribute);
        if ((savedCoordinates !== null) && (savedCoordinates !== '')) {
            savedCoordinates = savedCoordinates.split(',');
            if (savedCoordinates.length >= 2) {
                if (!isNaN(savedCoordinates[0]) && !isNaN(savedCoordinates[1]))
                    return [Number(savedCoordinates[0]), Number(savedCoordinates[1])];
            }
        }
        return null;
    }

    async _refreshMetadataAsync(rebuild, cancellable) {
        if (this._destroyed)
            return;


        if (this._queryFileInfoCancellable)
            this._queryFileInfoCancellable.cancel();

        if (!cancellable)
            cancellable = new Gio.Cancellable();
        this._queryFileInfoCancellable = cancellable;

        try {
            const newFileInfo =
                await this._file.query_info_async(this.Enums.DEFAULT_ATTRIBUTES,
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT,
                    cancellable);
            let oldLabelText = this._currentFileName;
            this._updateMetadataFromFileInfo(newFileInfo);
            if (this.displayName !== oldLabelText)
                this._setFileName(this.displayName);

            this._updateName();
            if (rebuild) {
                try {
                    await this._updateIcon(cancellable);
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        throw e;
                    logError(e, `Exception while updating the icon after a metadata update: ${e.message}`);
                }
            }
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(e, `Error getting file info: ${e.message}`);
        } finally {
            if (this._queryFileInfoCancellable === cancellable)
                this._queryFileInfoCancellable = null;
        }
    }

    _updateMetadataFromFileInfo(fileInfo) {
        this._fileInfo = fileInfo;

        this._displayName = this._getVisibleName();
        this._attributeCanExecute = fileInfo.get_attribute_boolean(Gio.FILE_ATTRIBUTE_ACCESS_CAN_EXECUTE);
        this._unixmode = fileInfo.get_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE);
        this._writableByOthers = (this._unixmode & this.Enums.UnixPermissions.S_IWOTH) !== 0;
        this._trusted = fileInfo.get_attribute_as_string('metadata::trusted') === 'true';
        this._attributeContentType = fileInfo.get_content_type();
        this._isDesktopFile = this._attributeContentType === 'application/x-desktop';

        if (this._isDesktopFile && this._writableByOthers)
            log(`desktop-icons: File ${this._displayName} is writable by others - will not allow launching`);

        if (this._isDesktopFile) {
            try {
                this._desktopFile = Gio.DesktopAppInfo.new_from_filename(this._file.get_path());
                if (!this._desktopFile) {
                    log(`Couldn’t parse ${this._displayName} as a desktop file, will treat it as a regular file.`);
                    this._isValidDesktopFile = false;
                } else {
                    this._isValidDesktopFile = true;
                }
            } catch (e) {
                print(`Error reading Desktop file ${this.uri}: ${e}`);
            }
        } else {
            this._isValidDesktopFile = false;
        }

        this._fileType = fileInfo.get_file_type();
        this._isDirectory = this._fileType === Gio.FileType.DIRECTORY;
        this._isSpecial = this._fileExtra !== this.Enums.FileType.NONE;
        this._isHidden = fileInfo.get_attribute_boolean(Gio.FILE_ATTRIBUTE_STANDARD_IS_HIDDEN) ||
            fileInfo.get_attribute_boolean(Gio.FILE_ATTRIBUTE_STANDARD_IS_BACKUP);
        this._modifiedTime = fileInfo.get_attribute_uint64(Gio.FILE_ATTRIBUTE_TIME_MODIFIED);
        this._isSymlink = fileInfo.get_attribute_boolean(Gio.FILE_ATTRIBUTE_STANDARD_IS_SYMLINK);
        /*
         * This is a glib trick to detect broken symlinks. If a file is a symlink, the filetype
         * points to the final file, unless it is broken; thus if the file type is SYMBOLIC_LINK,
         * it must be a broken link.
         * https://developer.gnome.org/gio/stable/GFile.html#g-file-query-info
         */
        this._isBrokenSymlink = this._isSymlink && this._fileType === Gio.FileType.SYMBOLIC_LINK;
        if (this._isSymlink && !this._symlinkFileMonitor)
            this._monitorSymlink();
    }

    _monitorSymlink() {
        let symlinkTarget = this._fileInfo.get_symlink_target();
        let symlinkTargetGioFile = Gio.File.new_for_path(symlinkTarget);
        this._symlinkFileMonitor = symlinkTargetGioFile.monitor(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._symlinkFileMonitor.set_rate_limit(1000);
        this._symlinkFileMonitorId = this._symlinkFileMonitor.connect('changed', this._updateSymlinkIcon.bind(this));
    }

    _updateSymlinkIcon() {
        this._refreshMetadataAsync(true, null);
    }

    async _doOpenContext(context, fileList) {
        if (!fileList)
            fileList = [];

        if (this._isBrokenSymlink) {
            try {
                log(`Error: Can’t open ${this.file.get_uri()} because it is a broken symlink.`);
                let title = _('Broken Link');
                let error = _('Can not open this File because it is a Broken Symlink');
                this._showerrorpopup(title, error);
            } catch (e) {}
            return;
        }

        if (this._isDesktopFile) {
            try {
                this._launchDesktopFile(context, fileList);
            } catch (e) {}
            return;
        }

        if (this._isDirectory && this._desktopManager.useNemo) {
            try {
                this.DesktopIconsUtil.trySpawn(GLib.get_home_dir(), ['nemo', this.file.get_uri()], this.DesktopIconsUtil.getFilteredEnviron());
            } catch (err) {
                log(`Error trying to launch Nemo: ${err.message}\n${err}`);
            }
            return;
        }

        if (!this.DBusUtils.GnomeArchiveManager.isAvailable &&
            this._fileType === Gio.FileType.REGULAR &&
            this._desktopManager.autoAr.fileIsCompressed(this.fileName)) {
            this._desktopManager.autoAr.extractFile(this.fileName);
            return;
        }

        if (this.isExecutable && this.executableContentType && !this.fileContainsText) {
            this.DesktopIconsUtil.trySpawn(this.DesktopIconsUtil.getDesktopDir().get_path(), [this.path], null);
            return;
        }

        try {
            await Gio.AppInfo.launch_default_for_uri_async(this.file.get_uri(),
                null, null);
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_SUPPORTED)) {
                let title = _('Opening File Failed');
                let defaultAppInfo = Gio.content_type_get_description(this.attributeContentType);
                let error = _('There is no application installed to open "{foo}" type of files').replace('{foo}', defaultAppInfo);
                this._showerrorpopup(title, error);
            } else {
                logError(e, `Error opening file ${this.file.get_uri()}: ${e.message}`);
            }
        }
    }

    _textEntryAccelsTurnOff() {
        this._desktopManager.textEntryAccelsTurnOff();
    }

    _textEntryAccelsTurnOn() {
        this._desktopManager.textEntryAccelsTurnOn();
    }

    _showerrorpopup(title, error) {
        let modal = true;
        new this._desktopManager.showErrorPopup.ShowErrorPopup(
            title,
            error,
            modal,
            this._textEntryAccelsTurnOff.bind(this),
            this._textEntryAccelsTurnOn.bind(this),
            this.DesktopIconsUtil
        );
    }

    _launchDesktopFile(context, fileList) {
        let object = this.DesktopIconsUtil.checkAppOpensFileType(this._desktopFile, fileList[0], null);
        if (this.trustedDesktopFile && (!fileList.length || object.canopenFile)) {
            this._desktopFile.launch_uris_as_manager(fileList, context, GLib.SpawnFlags.SEARCH_PATH, null, null);
            return;
        } else if (this.trustedDesktopFile && !object.canopenFile) {
            let Appname = object.Appname;
            let title = _('Could not open File');
            // eslint-disable-next-line no-template-curly-in-string
            let error = _('${appName} can not open files of this Type!').replace('${appName}', Appname);
            this._showerrorpopup(title, error);
        }

        if (!this._isValidDesktopFile) {
            let title = _('Broken Desktop File');
            let error = _('This .desktop file has errors or points to a program without permissions. It can not be executed.\n\n\t<b>Edit the file to set the correct executable Program.</b>');
            this._showerrorpopup(title, error);
            return;
        }

        if (this._writableByOthers || !this._attributeCanExecute) {
            let title = _('Invalid Permissions on Desktop File');
            let error = _('This .desktop File has incorrect Permissions. Right Click to edit Properties, then:\n');
            if (this._writableByOthers)
                error += _('\n<b>Set Permissions, in "Others Access", "Read Only" or "None"</b>');

            if (!this._attributeCanExecute)
                error += _('\n<b>Enable option, "Allow Executing File as a Program"</b>');

            this._showerrorpopup(title, error);
            return;
        }

        if (!this.trustedDesktopFile) {
            let title = 'Untrusted Desktop File';
            let error = _('This .desktop file is not trusted, it can not be launched. To enable launching, right-click, then:\n\n<b>Enable "Allow Launching"</b>');
            this._showerrorpopup(title, error);
        }
    }

    _updateName() {
        if (this._isValidDesktopFile && !this._desktopManager.writableByOthers && !this._writableByOthers && this.trustedDesktopFile)
            this._setFileName(this._desktopFile.get_locale_string('Name'));
        else
            this._setFileName(this._getVisibleName());
    }

    _monitorTrash() {
        this._trashChanged = false;
        this._queryTrashInfoCancellable = null;
        this._scheduleTrashRefreshId = 0;
        this._monitorTrashDir = this._file.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._monitorTrashId = this._monitorTrashDir.connect('changed', (obj, file, otherFile, eventType) => {
            switch (eventType) {
            case Gio.FileMonitorEvent.DELETED:
            case Gio.FileMonitorEvent.MOVED_OUT:
            case Gio.FileMonitorEvent.CREATED:
            case Gio.FileMonitorEvent.MOVED_IN:
                if (this._queryTrashInfoCancellable || this._scheduleTrashRefreshId) {
                    if (this._scheduleTrashRefreshId)
                        GLib.source_remove(this._scheduleTrashRefreshId);

                    if (this._queryTrashInfoCancellable) {
                        this._queryTrashInfoCancellable.cancel();
                        this._queryTrashInfoCancellable = null;
                    }
                    this._scheduleTrashRefreshId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                        this._refreshTrashIcon().catch(e => logError(e));
                        this._scheduleTrashRefreshId = 0;
                        return GLib.SOURCE_REMOVE;
                    });
                } else {
                    this._refreshTrashIcon().catch(e => logError(e));
                    // after a refresh, don't allow more refreshes until 200ms after, to coalesce extra events
                    this._scheduleTrashRefreshId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                        this._scheduleTrashRefreshId = 0;
                        return GLib.SOURCE_REMOVE;
                    });
                }
                break;
            }
        });
    }

    /** *********************
     * Button Clicks *
     ***********************/

    _doButtonOnePressed(button, X, Y, x, y, shiftPressed, controlPressed) {
        super._doButtonOnePressed(button, X, Y, x, y, shiftPressed, controlPressed);
        if (this.getClickCount() === 2 && !this.Prefs.CLICK_POLICY_SINGLE)
            this.doOpen();
    }

    _doButtonOneReleased(button, X, Y, x, y, shiftPressed, controlPressed) {
        if (this.getClickCount() === 1 &&
             this.Prefs.CLICK_POLICY_SINGLE &&
             !shiftPressed &&
             !controlPressed)
            this.doOpen();
    }

    /** *********************
     * Drag and Drop *
     ***********************/

    async receiveDrop(X, Y, x, y, dropData, acceptFormat, gdkDropAction, localDrop, event, dragItem) {
        if (!this.dropCapable)
            return false;

        if (acceptFormat !== this.Enums.DndTargetInfo.DING_ICON_LIST &&
            acceptFormat !== this.Enums.DndTargetInfo.GNOME_ICON_LIST &&
            acceptFormat !== this.Enums.DndTargetInfo.URI_LIST)
            return false;

        const fileList = this._desktopManager.makeFileListFromSelection(dropData, acceptFormat);
        if (!fileList)
            return false;

        if (dragItem && (dragItem.uri === this._file.get_uri() ||
            !(this._isValidDesktopFile || this.isDirectory))) {
            // Dragging a file/folder over itself or over another file will do nothing,
            // allow drag to directory or valid desktop file
            return false;
        }

        if (this._isValidDesktopFile) {
            // open the desktop file with these dropped files as the arguments
            this.doOpen(fileList);
            return Gdk.DragAction.COPY;
        }

        const forceCopy = gdkDropAction === Gdk.DragAction.COPY;

        if (this._fileExtra === this.Enums.FileType.USER_DIRECTORY_TRASH) {
            if (localDrop) {
                this._desktopManager.doTrash(localDrop, event);
            } else {
                this.DBusUtils.RemoteFileOperations.pushEvent(event);
                this.DBusUtils.RemoteFileOperations.TrashURIsRemote(fileList);
            }
            if (forceCopy)
                return Gdk.DragAction.COPY;
            else
                return Gdk.DragAction.MOVE;
        }

        let returnAction;

        if (gdkDropAction === Gdk.DragAction.MOVE || gdkDropAction === Gdk.DragAction.COPY) {
            if (localDrop)
                this._desktopManager.saveCurrentFileCoordinatesForUndo(fileList);
            try {
                returnAction = await this._desktopManager.copyOrMoveUris(fileList,
                    this._file.get_uri(), event, {forceCopy});
            } catch (e) {
                logError(e);
                return false;
            }
        } else {
            if (gdkDropAction >= Gdk.DragAction.LINK)
                returnAction = Gdk.DragAction.LINK;
            else
                returnAction = Gdk.DragAction.COPY;
            this._desktopManager.askWhatToDoWithFiles(fileList, this._file.get_uri(),
                X, Y, x, y, event, {desktopActions: false});
        }

        return returnAction;
    }

    _hasToRouteDragToGrid() {
        return this._isSelected && this._desktopManager.dragItem && (this._desktopManager.dragItem.uri !== this._file.get_uri());
    }

    _dropCapable() {
        if ((this._fileExtra === this.Enums.FileType.USER_DIRECTORY_TRASH) ||
            (this._fileExtra === this.Enums.FileType.USER_DIRECTORY_HOME) ||
            this._isDirectory ||
            this._isValidDesktopFile ||
            this._hasToRouteDragToGrid())
            return true;
        else
            return false;
    }

    /** *********************
     * Icon Rendering *
     ***********************/

    async _refreshTrashIcon() {
        if (this._queryTrashInfoCancellable) {
            this._queryTrashInfoCancellable.cancel();
            this._queryTrashInfoCancellable = null;
        }

        const cancellable = new Gio.Cancellable();
        this._queryTrashInfoCancellable = cancellable;

        try {
            this._fileInfo =
                await this._file.query_info_async(this.Enums.DEFAULT_ATTRIBUTES,
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT,
                    cancellable);
            try {
                await this._updateIcon(cancellable);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    throw e;
                logError(e, `Exception while updating the trash icon: ${e.message}`);
            }
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                return false;

            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(e, `Error getting the number of files in the trash: ${e.message}`);
        } finally {
            if (cancellable === this._queryTrashInfoCancellable)
                this._queryTrashInfoCancellable = null;
        }

        return false;
    }

    /** *********************
     * Class Methods *
     ***********************/

    onAttributeChanged() {
        if (this._destroyed)
            return;

        if (this._isDesktopFile)
            this._refreshMetadataAsync(true).catch(e => logError(e));
    }

    updatedMetadata() {
        this._refreshMetadataAsync(true).catch(e => logError(e));
    }

    onFileRenamed(file) {
        this._file = file;
        this._refreshMetadataAsync(false).catch(e => logError(e));
    }

    async eject(atWidget) {
        if (!this._custom || this._ejectCancellable)
            return;

        const parentWidget =  atWidget ?? this._grid._window;
        const mountOp = new Gtk.MountOperation();
        mountOp.set_parent(parentWidget);
        this._ejectCancellable = new Gio.Cancellable();
        try {
            await this._custom.eject_with_operation(Gio.MountUnmountFlags.NONE,
                mountOp, this._ejectCancellable);
        } finally {
            this._ejectCancellable = null;
        }
    }

    async unmount(atWidget) {
        if (!this._custom || this._umountCancellable)
            return;

        const parentWidget = atWidget ?? this._grid._window;
        const mountOp = new Gtk.MountOperation();
        mountOp.set_parent(parentWidget);
        this._umountCancellable = new Gio.Cancellable();
        try {
            await this._custom.unmount_with_operation(Gio.MountUnmountFlags.NONE,
                mountOp, this._umountCancellable);
        } finally {
            this._umountCancellable = null;
        }
    }

    doOpen(fileList) {
        if (!fileList)
            fileList = [];

        this._doOpenContext(null, fileList).catch(e => logError(e));
    }

    async onAllowDisallowLaunchingClicked() {
        this.metadataTrusted = !this.trustedDesktopFile;

        /*
         * we're marking as trusted, make the file executable too. Note that we
         * do not ever remove the executable bit, since we don't know who set
         * it.
         */
        if (this.metadataTrusted && !this._attributeCanExecute) {
            let info = new Gio.FileInfo();
            let newUnixMode = this._unixmode | this.Enums.UnixPermissions.S_IXUSR;
            info.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, newUnixMode);
            await this._setFileAttributes(info);
        }
        this._updateName();
    }

    doDiscreteGpu() {
        if (!this.DBusUtils.discreteGpuAvailable) {
            log('Could not apply discrete GPU environment, switcheroo-control not available');
            return;
        }
        let gpus = this.DBusUtils.SwitcherooControl.proxy.GPUs;
        if (!gpus) {
            log('Could not apply discrete GPU environment. No GPUs in list.');
            return;
        }

        for (let gpu in gpus) {
            if (!gpus[gpu])
                continue;

            let defaultVariant = gpus[gpu]['Default'];
            if (!defaultVariant || defaultVariant.get_boolean())
                continue;

            let env = gpus[gpu]['Environment'];
            if (!env)
                continue;

            let envS = env.get_strv();
            let context = new Gio.AppLaunchContext();
            for (let i = 0; i < envS.length; i += 2)
                context.setenv(envS[i], envS[i + 1]);

            this._doOpenContext(context, null).catch(e => logError(e));
            return;
        }
        log('Could not find discrete GPU data in switcheroo-control');
    }

    _onOpenTerminalClicked() {
        this.DesktopIconsUtil.launchTerminal(this.file.get_path(), null);
    }

    async _setFileAttributes(fileInfo, cancellable = null, opts = {refresh: true}) {
        await this._file.set_attributes_async(fileInfo,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_LOW,
            cancellable);

        if (cancellable && cancellable.is_cancelled()) {
            throw new GLib.Error(Gio.IOErrorEnum,
                Gio.IOErrorEnum.CANCELLED,
                'Operation was cancelled');
        }

        if (opts.refresh)
            await this._refreshMetadataAsync(true, cancellable);
    }

    async _storeCoordinates(name, coords, cancellable = null) {
        const info = new Gio.FileInfo();
        info.set_attribute_string(`metadata::${name}`,
            `${coords ? coords.join(',') : ''}`);

        await this._setFileAttributes(info, cancellable, {refresh: false});
    }

    /** *********************
     * Getters and setters *
     ***********************/

    get attributeContentType() {
        return this._attributeContentType;
    }

    get attributeCanExecute() {
        return this._attributeCanExecute;
    }

    get canEject() {
        if (this._custom)
            return this._custom.can_eject();
        else
            return false;
    }

    get canRename() {
        return !this.trustedDesktopFile && (this._fileExtra === this.Enums.FileType.NONE);
    }

    get canUnmount() {
        if (this._custom)
            return this._custom.can_unmount();
        else
            return false;
    }

    get displayName() {
        if (this.trustedDesktopFile)
            return this._desktopFile.get_name();

        return this._displayName || null;
    }

    get dropCoordinates() {
        return this._dropCoordinates;
    }

    set dropCoordinates(pos) {
        if (this.DesktopIconsUtil.coordinatesEqual(this._dropCoordinates, pos))
            return;

        const oldPos = this._dropCoordinates;
        this._dropCoordinates = pos;

        if (this._dropCoordinatesCancellable)
            this._dropCoordinatesCancellable.cancel();

        const cancellable = new Gio.Cancellable();
        this._dropCoordinatesCancellable = cancellable;

        this._storeCoordinates('nautilus-drop-position', pos, cancellable).catch(e => {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                logError(e, `Failed to store the desktop coordinates for ${this.uri}: ${e.message}`);
                this._dropCoordinates = oldPos;
            }
        }).finally(() => {
            if (this._dropCoordinatesCancellable === cancellable)
                this._dropCoordinatesCancellable = null;
        });
    }

    get execLine() {
        return this._execLine;
    }

    get executableContentType() {
        return Gio.content_type_can_be_executable(this.attributeContentType);
    }

    get file() {
        return this._file;
    }

    get fileContainsText() {
        return this._attributeContentType === 'text/plain';
    }

    get fileName() {
        return this._fileInfo.get_name();
    }

    get fileSize() {
        return this._fileInfo.get_size();
    }

    get isAllSelectable() {
        return this._fileExtra === this.Enums.FileType.NONE;
    }

    get isDirectory() {
        return this._isDirectory;
    }

    get isExecutable() {
        return this._attributeCanExecute;
    }

    get isHidden() {
        return this._isHidden;
    }

    get isTrash() {
        return this._fileExtra === this.Enums.FileType.USER_DIRECTORY_TRASH;
    }

    get metadataTrusted() {
        return this._trusted;
    }

    set metadataTrusted(value) {
        this._trusted = value;

        if (this._setMetadataTrustedCancellable)
            this._setMetadataTrustedCancellable.cancel();


        const cancellable = new Gio.Cancellable();
        this._setMetadataTrustedCancellable = cancellable;

        let info = new Gio.FileInfo();
        info.set_attribute_string('metadata::trusted',
            value ? 'true' : 'false');

        this._setFileAttributes(info, cancellable).catch(e => {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(e, `Failed to set metadata::trusted: ${e.message}`);
        }).finally(() => {
            if (cancellable === this._setMetadataTrustedCancellable)
                this._setMetadataTrustedCancellable = null;
        });
    }

    get modifiedTime() {
        return this._modifiedTime;
    }

    get path() {
        return this._file.get_path();
    }

    get savedCoordinates() {
        return this._savedCoordinates;
    }

    set savedCoordinates(pos) {
        if (this.DesktopIconsUtil.coordinatesEqual(this._savedCoordinates, pos))
            return;

        const oldPos = this._savedCoordinates;
        this._savedCoordinates = pos;

        if (this._savedCoordinatesCancellable)
            this._savedCoordinatesCancellable.cancel();

        const cancellable = new Gio.Cancellable();
        this._savedCoordinatesCancellable = cancellable;

        this._storeCoordinates('nautilus-icon-position', pos, cancellable).catch(e => {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                logError(e, `Failed to store the desktop coordinates for ${this.uri}: ${e.message}`);
                this._savedCoordinates = oldPos;
            }
        }).finally(() => {
            if (this._savedCoordinatesCancellable === cancellable)
                this._savedCoordinatesCancellable = null;
        });
    }

    set temporarySavedPosition(pos) {
        this._savedCoordinates = pos;
    }

    get trustedDesktopFile() {
        return this._isValidDesktopFile &&
               this._attributeCanExecute &&
               this.metadataTrusted &&
               !this._desktopManager.writableByOthers &&
               !this._writableByOthers;
    }

    get uri() {
        return this._file.get_uri();
    }

    get isValidDesktopFile() {
        return this._isValidDesktopFile;
    }

    get writableByOthers() {
        return this._writableByOthers;
    }

    get isStackMarker() {
        if (this.isStackTop && !this.stackUnique)
            return true;
        else
            return false;
    }
};
Signals.addSignalMethods(FileItem.prototype);
