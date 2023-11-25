/**
 * Extension
 *
 * @author     Javad Rahmatzadeh <j.rahmatzadeh@gmail.com>
 * @copyright  2020-2023
 * @license    GPL-3.0-only
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import * as BackgroundMenu from 'resource:///org/gnome/shell/ui/backgroundMenu.js';
import * as LookingGlass from 'resource:///org/gnome/shell/ui/lookingGlass.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as OSDWindow from 'resource:///org/gnome/shell/ui/osdWindow.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as Panel from 'resource:///org/gnome/shell/ui/panel.js';
import * as SearchController from 'resource:///org/gnome/shell/ui/searchController.js';
import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import * as WindowMenu from 'resource:///org/gnome/shell/ui/windowMenu.js';
import * as WindowPreview from 'resource:///org/gnome/shell/ui/windowPreview.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspacesView from 'resource:///org/gnome/shell/ui/workspacesView.js';
import * as WorkspaceSwitcherPopup from 'resource:///org/gnome/shell/ui/workspaceSwitcherPopup.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {API} from './lib/API.js';
import {Manager} from './lib/Manager.js';

/**
 * Extension entry point
 */
export default class JustPerfection extends Extension
{
    /**
     * Instance of API
     *
     * @type {API|null}
     */
     #api = null;

    /**
     * Instance of Manager
     *
     * @type {Manager|null}
     */
     #manager = null;

    /**
     * Enable extension
     *
     * @returns {void}
     */
    enable()
    {
        const shellVersion = parseFloat(Config.PACKAGE_VERSION);

        let InterfaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});

        this.#api = new API({
            Main,
            BackgroundMenu,
            OverviewControls,
            WorkspaceSwitcherPopup,
            SwitcherPopup,
            InterfaceSettings,
            SearchController,
            WorkspaceThumbnail,
            WorkspacesView,
            Panel,
            WindowPreview,
            Workspace,
            LookingGlass,
            MessageTray,
            OSDWindow,
            WindowMenu,
            AltTab,
            St,
            Gio,
            GLib,
            Clutter,
            Util,
            Meta,
            GObject,
        }, shellVersion);

        this.#api.open();

        let settings = this.getSettings();

        this.#manager = new Manager({
            API: this.#api,
            Settings: settings,
        }, shellVersion);

        this.#manager.registerSettingsSignals();
        this.#manager.applyAll();
    }

    /**
     * Disable extension
     *
     * @returns {void}
     */
    disable()
    {
        this.#manager?.revertAll();
        this.#manager = null;

        this.#api?.close();
        this.#api = null;
    }
}

