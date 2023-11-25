/**
 * Prefs Library
 *
 * @author     Javad Rahmatzadeh <j.rahmatzadeh@gmail.com>
 * @copyright  2020-2023
 * @license    GPL-3.0-only
 */

/**
 * prefs widget for showing prefs window
 */
export class Prefs
{
    /**
     * class constructor
     *
     * @param {Object} dependencies
     *   'Builder' instance of Gtk::Builder
     *   'Settings' instance of Gio::Settings
     *   'Gtk' reference to Gtk
     *   'Gdk' reference to Gdk
     *   'Gio' reference to Gio
     *   'GLib' reference to GLib
     * @param {PrefsKeys.PrefsKeys} prefsKeys instance of PrefsKeys
     * @param {number} shellVersion float in major.minor format
     */
    constructor(dependencies, prefsKeys, shellVersion)
    {
        this._settings = dependencies['Settings'] || null;
        this._builder = dependencies['Builder'] || null;
        this._gtk = dependencies['Gtk'] || null;
        this._gdk = dependencies['Gdk'] || null;
        this._gio = dependencies['Gio'] || null;
        this._glib = dependencies['GLib'] || null;

        this._prefsKeys = prefsKeys;
        this._shellVersion = shellVersion;

        /**
         * holds all profile names
         *
         * @member {string}
         */
        this._profiles = [
            'default',
            'minimal',
            'superminimal',
        ];

        /**
         * holds all required urls
         *
         * @member {Object}
         */
        this._url = {
            bug_report: 'https://gitlab.gnome.org/jrahmatzadeh/just-perfection/-/issues',
            patreon: 'https://www.patreon.com/justperfection',
        };
    }

    /**
     * fill prefs window
     *
     * @param {string} UIFolderPath folder path to ui folder
     * @param {string} gettextDomain gettext domain
     *
     * @returns {void}
     */
     fillPrefsWindow(window, UIFolderPath, gettextDomain)
     {
         // changing the order here can change the elements order in ui 
         let uiFilenames = [
             'profile',
             'visibility',
             'icons',
             'behavior',
             'customize',
         ];
 
         this._builder.set_translation_domain(gettextDomain);
         for (let uiFilename of uiFilenames) {
             this._builder.add_from_file(`${UIFolderPath}/adw/${uiFilename}.ui`);
         }

         for (let uiFilename of uiFilenames) {
             let page = this._builder.get_object(uiFilename);
             window.add(page);
         }
 
         this._setValues();
         this._guessProfile();
         this._onlyShowSupportedRows();
         this._registerAllSignals(window);

         this._setWindowSize(window);

         window.search_enabled = true;
     }

    /**
     * set window size
     *
     * @param {Adw.PreferencesWindow} window prefs window
     *
     * @returns {void}
     */
    _setWindowSize(window)
    {
        let [pmWidth, pmHeight, pmScale] = this._getPrimaryMonitorInfo();
        let sizeTolerance = 50;
        let width = 600;
        let height = 650;

        if (
            (pmWidth / pmScale) - sizeTolerance >= width &&
            (pmHeight / pmScale) - sizeTolerance >= height
        ) {
            window.set_default_size(width, height);
        }
    }

    /**
     * get primary monitor info
     *
     * @returns {Array} [width, height, scale]
     */
    _getPrimaryMonitorInfo()
    {
        let display = this._gdk.Display.get_default();

        let pm = display.get_monitors().get_item(0);

        if (!pm) {
            return [700, 500, 1];
        }

        let geo = pm.get_geometry();
        let scale = pm.get_scale_factor();

        return [geo.width, geo.height, scale];
    }

    /**
     * register all signals
     *
     * @param {Adw.PreferencesWindow} window prefs dialog
     *
     * @returns {void}
     */
    _registerAllSignals(window)
    {
        this._registerKeySignals();
        this._registerProfileSignals();
    }

    /**
     * register signals of all prefs keys
     *
     * @returns {void}
     */
     _registerKeySignals()
     {
         // all available keys
         for (let [, key] of Object.entries(this._prefsKeys.keys)) {
 
             switch (key.widgetType) {
 
                 case 'GtkSwitch':
                     this._builder.get_object(key.widgetId).connect('state-set', (w) => {
                         this._settings.set_boolean(key.name, w.get_active());
                         this._guessProfile();
                     });
                     break;
 
                 case 'AdwActionRow':
                     this._builder.get_object(key.widgetId).connect('notify::selected-item', (w) => {
                         let index = w.get_selected();
                         let value = (index in key.maps) ? key.maps[index] : index; 
                         this._settings.set_int(key.name, value);
                         this._guessProfile();
                     });
                     break;
             }
         }
    }

    /**
     * register profile signals
     *
     * @returns {void}
     */
    _registerProfileSignals()
    {
        for (let profile of this._profiles) {
            let widget = this._builder.get_object(`profile_${profile}`);
            if (!widget) {
                break;
            }
            widget.connect('clicked', (w) => {
                this._setValues(profile);
            });
        }
    }

    /**
     * open uri
     *
     * @param {string} uri uri to open
     * @param {Adw.PreferencesWindow} window prefs dialog
     *
     * @returns {void}
     */
    _openURI(window, uri)
    {
        this._gtk.show_uri(window, uri, this._gdk.CURRENT_TIME);
    }

    /**
     * can check all current values and guess the profile based on the values
     *
     * @returns {void}
     */
    _guessProfile()
    {
        let totalCount = 0;
        let matchCount = {};

        for (let profile of this._profiles) {
            matchCount[profile] = 0;
        }

        for (let [, key] of Object.entries(this._prefsKeys.keys)) {
        
            if (!key.supported) {
                continue;
            }

            let value;

            switch (key.widgetType) {
                case 'GtkSwitch':
                    value = this._builder.get_object(key.widgetId).get_active();
                    break;
                case 'AdwActionRow':
                    value = this._builder.get_object(key.widgetId).get_selected();
                    break;
                default:
                    value = '';
                    continue;
            }
            
            for (let profile of this._profiles) {
                if (key.profiles[profile] === value) {
                    matchCount[profile]++;
                }
            }

            totalCount++;
        }

        let currentProfile = 'custom';
        for (let profile of this._profiles) {
            if (matchCount[profile] === totalCount) {
                currentProfile = profile;
                break;
            }
        }
        
        let widget = this._builder.get_object(`profile_${currentProfile}`);
        if (widget) {
            widget.set_active(true);
        }
    }

    /**
     * set file chooser button value
     *
     * @param {string} id element starter id
     * @param {string} uri file address
     * @param {bool} entrySetBefore whether file chooser entry value has been set before
     *
     * @returns {void}
     */
    _setFileChooserValue(id, uri, entrySetBefore = false)
    {
        let preview = this._builder.get_object(`${id}_preview`);
        let emptyButton = this._builder.get_object(`${id}_empty_button`);
        let entry = this._builder.get_object(`${id}_entry`);

        if (!entry) {
            return;
        }

        let file = this._gio.File.new_for_uri(uri);
        let fileExists = file.query_exists(null);
        let uriPrepared = (fileExists) ? uri : '';

        let visible = uriPrepared !== '';

        if (!entrySetBefore) {
            entry.text = uriPrepared;
        }
        emptyButton.visible = visible;

        preview.clear();

        if (fileExists) {
            let gicon = this._gio.icon_new_for_string(file.get_path());
            preview.set_from_gicon(gicon);
        } else {
            preview.icon_name = 'document-open-symbolic';
        }
    }

    /**
     * set values for all elements
     *
     * @param {string} profile profile name or null for get it from gsettings
     *
     * @returns {void}
     */
    _setValues(profile)
    {
        for (let [, key] of Object.entries(this._prefsKeys.keys)) {

            let widget = this._builder.get_object(key.widgetId);

            switch (key.widgetType) {

                case 'GtkSwitch':
                    let value
                    = (profile)
                    ? key.profiles[profile]
                    : this._settings.get_boolean(key.name);

                    widget.set_active(value);
                    break;

                case 'AdwActionRow':
                    let index
                    = (profile)
                    ? key.profiles[profile]
                    : this._settings.get_int(key.name);

                    for (let k in key.maps) {
                        if (key.maps[k] === index) {
                            index = k;
                            break;
                        }
                    }
                    widget.set_selected(index);
                    break;
            }
        }
    }

    /**
     * apply all supported keys to the elements
     *
     * @returns {void}
     */
     _onlyShowSupportedRows()
     {
         for (let [, key] of Object.entries(this._prefsKeys.keys)) {
            let row = this._builder.get_object(`${key.id}_row`);
            let visible = key.supported;
            row.visible = visible;
        }
     }
};

