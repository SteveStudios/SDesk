#!/usr/bin/env gjs

/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com) port to Gtk.app-
 * to communicate over dbus.
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

imports.gi.versions.Gtk = '3.0';
const { Gtk, GLib, Gio } = imports.gi;

var asDesktop = false;
var codePath;
var ThumbnailLoaderLoaded = null;
var errorFound;

/**
 *
 * @param {string} ARGV command line arguments, asdesktop and codePath
 */
function parseCommandLine(ARGV) {
    if (ARGV.includes('asdesktop'))
        asDesktop = true;

    if (ARGV.length === 0)
        codePath = '.';
    else
        codePath = ARGV[0];
}

parseCommandLine(ARGV);

imports.searchPath.unshift(codePath);
const Thumbnail = imports.app.thumbnails;
const FileUtils = imports.utils.fileUtils;

var ThumbnailApp = class extends Thumbnail.ThumbnailLoader {
    constructor(path, desktopBoolean, appName, fileutils) {
        super(path, fileutils);
        this.mainApp = appName;
        this.asDesktop = desktopBoolean;
        this._codePath = codePath;
        this._dbusAdvertiseUpdate();
        this.mainApp.hold();
        this._sigtermID = GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
            GLib.source_remove(this._sigtermID);
            this._forcedExit = true;
            if (this._running)
                this._proc.force_exit();

            this.mainApp.release();
            return false;
        });
    }

    _dbusAdvertiseUpdate() {
        let updateThumbnail = new Gio.SimpleAction({
            name: 'updateThumbnail',
            parameter_type: new GLib.VariantType('as'),
        });
        updateThumbnail.connect('activate', async (action, parameter) => {
            let [fileUri, filePath, fileAttributeContentType, fileModifiedTime] = parameter.recursiveUnpack();
            const gioFile = Gio.File.new_for_uri(fileUri);
            const file = {
                'uri': fileUri,
                'path': filePath,
                'file': gioFile,
                'attributeContentType': fileAttributeContentType,
                'modifiedTime': fileModifiedTime,
            };
            const cancellable = new Gio.Cancellable();
            const thumbnail = await this.getThumbnail(file, cancellable);
            if (thumbnail !== null)
                this._updateDesktopIcon(file, thumbnail);
        });
        let actionGroup = new Gio.SimpleActionGroup();
        let busname = this.mainApp.get_dbus_object_path();
        this._connection = Gio.DBus.session;
        this._dbusConnectionGroupId = this._connection.export_action_group(
            `${busname}/actions`,
            actionGroup
        );
        if (this.asDesktop) {
            this.remoteDingUpdate = Gio.DBusActionGroup.get(
                Gio.DBus.session,
                'com.desktop.ding',
                '/com/desktop/ding/actions'
            );
        } else {
            this.remoteDingUpdate = Gio.DBusActionGroup.get(
                Gio.DBus.session,
                'com.desktop.dingtest',
                '/com/desktop/dingtest/actions'
            );
        }
        actionGroup.add_action(updateThumbnail);
    }

    _updateDesktopIcon(file, thumbnail) {
        let thumbnailUpdateVariant = new GLib.Variant('as', [file.uri, thumbnail]);
        this.remoteDingUpdate.activate_action('updateThumbnail', thumbnailUpdateVariant);
    }
};

const dingThumbnailApp = new Gtk.Application({
    application_id: asDesktop ? 'com.desktop.dingThumbnailer' : 'com.desktop.dingTestThumbnailer',
    flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
});

dingThumbnailApp.connect('startup', () => {
});

dingThumbnailApp.connect('activate', () => {
    if (!ThumbnailLoaderLoaded)
        ThumbnailLoaderLoaded = new ThumbnailApp(codePath, asDesktop, dingThumbnailApp, FileUtils);
});

dingThumbnailApp.connect('command-line', (app, commandLine) => {
    try {
        let argv = [];
        argv = commandLine.get_arguments();
        if (argv.length === 0)
            codePath = '.';
        else
            codePath = argv[0];

        if (!commandLine.get_is_remote())
            dingThumbnailApp.activate();

        commandLine.set_exit_status(0);
    } catch (e) {
        errorFound = true;
        print(`Error starting Thumbnail.js: ${e.message}\n${e.stack}`);
        commandLine.set_exit_status(1);
    }
});

dingThumbnailApp.run(ARGV);

if (!errorFound)
    0;
else
    1;
