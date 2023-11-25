/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com) gtk4 port
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
import {Gtk, Gdk} from '../dependencies/gi.js';
import {_} from '../dependencies/gettext.js';

export {ShowErrorPopup};

const ShowErrorPopup = class {
    constructor(text, secondaryText, modal, textEntryAccelsTurnOff, textEntryAccelsTurnOn, DesktopIconsUtil) {
        this.DesktopIconsUtil = DesktopIconsUtil;
        this._window = new Gtk.MessageDialog({
            transient_for: null,
            message_type: Gtk.MessageType.ERROR,
            buttons: Gtk.ButtonsType.NONE,
        });
        let label = this._window.get_message_area().get_first_child().get_next_sibling();
        label.set_justify(Gtk.Justification.CENTER);
        this._window.secondary_use_markup = true;
        this._window.text = text;
        this._window.secondary_text = secondaryText;
        this.DesktopIconsUtil.windowHidePagerTaskbarModal(this._window, true);
        textEntryAccelsTurnOff();
        this.deleteButton = this._window.add_button(_('Close'), Gtk.ResponseType.OK);
        this.deleteButton.connect('clicked', () => {
            textEntryAccelsTurnOn();
            this._window.hide();
            this._window.destroy();
            this._window = null;
        });
        this._window.connect('close-request', () => {
            textEntryAccelsTurnOn();
            this._window.destroy();
            this._window = null;
        });
        if (modal) {
            this._window.show();
            this._window.present_with_time(Gdk.CURRENT_TIME);
        }
    }

    run() {
        this._window.show();
        this._window.present_with_time(Gdk.CURRENT_TIME);
        this.timeoutClose(3000);
    }

    async timeoutClose(time) {
        await this.DesktopIconsUtil.waitDelayMs(time);
        if (this._window)
            this.deleteButton.activate();
    }
};
