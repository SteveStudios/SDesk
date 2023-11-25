/**
 * API Library
 *
 * @author     Javad Rahmatzadeh <j.rahmatzadeh@gmail.com>
 * @copyright  2020-2023
 * @license    GPL-3.0-only
 */

const XY_POSITION = {
    TOP_START: 0,
    TOP_CENTER: 1,
    TOP_END: 2,
    BOTTOM_START: 3,
    BOTTOM_CENTER: 4,
    BOTTOM_END: 5,
    CENTER_START: 6,
    CENTER_CENTER: 7,
    CENTER_END: 8,
};

const PANEL_POSITION = {
    TOP: 0,
    BOTTOM: 1,
};

const PANEL_BOX_POSITION = {
    CENTER: 0,
    RIGHT: 1,
    LEFT: 2,
};

const PANEL_HIDE_MODE = {
    ALL: 0,
    DESKTOP: 1,
};

const SHELL_STATUS = {
    NONE: 0,
    OVERVIEW: 1,
};

const ICON_TYPE = {
    NAME: 0,
    URI: 1,
};

const DASH_ICON_SIZES = [16, 22, 24, 32, 40, 48, 56, 64];

/**
 * API to avoid calling GNOME Shell directly
 * and make all parts compatible with different GNOME Shell versions 
 */
export class API
{
    /**
     * Class Constructor
     *
     * @param {Object} dependencies
     *   'Main' reference to ui::main
     *   'BackgroundMenu' reference to ui::backgroundMenu
     *   'OverviewControls' reference to ui::overviewControls
     *   'WorkspaceSwitcherPopup' reference to ui::workspaceSwitcherPopup
     *   'SwitcherPopup' reference to ui::switcherPopup
     *   'InterfaceSettings' reference to Gio::Settings for 'org.gnome.desktop.interface'
     *   'SearchController' reference to ui::searchController
     *   'WorkspaceThumbnail' reference to ui::workspaceThumbnail
     *   'WorkspacesView' reference to ui::workspacesView
     *   'Panel' reference to ui::panel
     *   'WindowPreview' reference to ui::windowPreview
     *   'Workspace' reference to ui::workspace
     *   'LookingGlass' reference to ui::lookingGlass
     *   'MessageTray' reference to ui::messageTray
     *   'OSDWindow' reference to ui::osdTray
     *   'WindowMenu' reference to ui::windowMenu
     *   'AltTab' reference to ui::altTab
     *   'St' reference to St
     *   'Gio' reference to Gio
     *   'GLib' reference to GLib
     *   'Clutter' reference to Clutter
     *   'Util' reference to misc::util
     *   'Meta' reference to Meta
     *   'GObject' reference to GObject
     * @param {number} shellVersion float in major.minor format
     */
    constructor(dependencies, shellVersion)
    {
        this._main = dependencies['Main'] || null;
        this._backgroundMenu = dependencies['BackgroundMenu'] || null;
        this._overviewControls = dependencies['OverviewControls'] || null;
        this._workspaceSwitcherPopup = dependencies['WorkspaceSwitcherPopup'] || null;
        this._switcherPopup = dependencies['SwitcherPopup'] || null;
        this._interfaceSettings = dependencies['InterfaceSettings'] || null;
        this._searchController = dependencies['SearchController'] || null;
        this._workspaceThumbnail = dependencies['WorkspaceThumbnail'] || null;
        this._workspacesView = dependencies['WorkspacesView'] || null;
        this._panel = dependencies['Panel'] || null;
        this._windowPreview = dependencies['WindowPreview'] || null;
        this._workspace = dependencies['Workspace'] || null;
        this._lookingGlass = dependencies['LookingGlass'] || null;
        this._messageTray = dependencies['MessageTray'] || null;
        this._osdWindow = dependencies['OSDWindow'] || null;
        this._windowMenu = dependencies['WindowMenu'] || null;
        this._altTab = dependencies['AltTab'] || null;
        this._st = dependencies['St'] || null;
        this._gio = dependencies['Gio'] || null;
        this._glib = dependencies['GLib'] || null;
        this._clutter = dependencies['Clutter'] || null;
        this._util = dependencies['Util'] || null;
        this._meta = dependencies['Meta'] || null;
        this._gobject = dependencies['GObject'] || null;

        this._shellVersion = shellVersion;
        this._originals = {};
        this._timeoutIds = {};

        /**
         * whether search entry is visible
         *
         * @member {boolean}
         */
        this._searchEntryVisibility = true;
    }

    /**
     * prepare everything needed for API
     *
     * @returns {void}
     */
    open()
    {
        this.UIStyleClassAdd(this._getAPIClassname('shell-version'));
    }

    /**
     * remove everything from GNOME Shell been added by this class 
     *
     * @returns {void}
     */
    close()
    {
        this.UIStyleClassRemove(this._getAPIClassname('shell-version'));
        this._startSearchSignal(false);
        this._computeWorkspacesBoxForStateSetDefault();
        this._altTabSizesSetDefault();
        
        for (let [name, id] of Object.entries(this._timeoutIds)) {
            this._glib.source_remove(id);
            delete(this._timeoutIds[name]);
        }
    }

    /**
     * get x and y align for position
     *
     * @param int pos position
     *   see XY_POSITION
     *
     * @returns {array}
     *  - 0 Clutter.ActorAlign
     *  - 1 Clutter.ActorAlign
     */
    _xyAlignGet(pos)
    {
        if (XY_POSITION.TOP_START === pos) {
            return [this._clutter.ActorAlign.START, this._clutter.ActorAlign.START];
        }

        if (XY_POSITION.TOP_CENTER === pos) {
            return [this._clutter.ActorAlign.CENTER, this._clutter.ActorAlign.START];
        }

        if (XY_POSITION.TOP_END === pos) {
            return [this._clutter.ActorAlign.END, this._clutter.ActorAlign.START];
        }

        if (XY_POSITION.CENTER_START === pos) {
            return [this._clutter.ActorAlign.START, this._clutter.ActorAlign.CENTER];
        }

        if (XY_POSITION.CENTER_CENTER === pos) {
            return [this._clutter.ActorAlign.CENTER, this._clutter.ActorAlign.CENTER];
        }

        if (XY_POSITION.CENTER_END === pos) {
            return [this._clutter.ActorAlign.END, this._clutter.ActorAlign.CENTER];
        }

        if (XY_POSITION.BOTTOM_START === pos) {
            return [this._clutter.ActorAlign.START, this._clutter.ActorAlign.END];
        }

        if (XY_POSITION.BOTTOM_CENTER === pos) {
            return [this._clutter.ActorAlign.CENTER, this._clutter.ActorAlign.END];
        }

        if (XY_POSITION.BOTTOM_END === pos) {
            return [this._clutter.ActorAlign.END, this._clutter.ActorAlign.END];
        }
    }

    /**
     * add to animation duration
     *
     * @param {number} duration in milliseconds
     *
     * @returns {number}
     */
    _addToAnimationDuration(duration)
    {
        let settings = this._st.Settings.get();

        return (settings.enable_animations) ? settings.slow_down_factor * duration : 1;
    }

    /**
     * get signal id of the event
     *
     * @param {Gtk.Widget} widget to find signal in
     * @param {string} signalName signal name
     *
     * @returns {number}
     */
    _getSignalId(widget, signalName)
    {
        return this._gobject.signal_handler_find(widget, {signalId: signalName});
    }

    /**
     * get the css class name for API
     *
     * @param {string} type
     *
     * @returns {string}
     */
    _getAPIClassname(type)
    {
        let starter = 'just-perfection-api-';

        if (type === 'shell-version') {
            let shellVerMajor = Math.trunc(this._shellVersion);
            return `${starter}gnome${shellVerMajor}`;
        }

        return `${starter}${type}`;
    }

    /**
     * set panel size to default
     *
     * @returns {void}
     */
    panelSetDefaultSize()
    {
        if (!this._originals['panelHeight']) {
            return;
        }

        this.panelSetSize(this._originals['panelHeight'], false);
    }

    /**
     * change panel size
     *
     * @param {number} size 0 to 100
     * @param {boolean} fake true means it shouldn't change the last size,
     *   false otherwise
     *
     * @returns {void}
     */
    panelSetSize(size, fake)
    {
        if (!this._originals['panelHeight']) {
            this._originals['panelHeight'] = this._main.panel.height;
        }

        if (size > 100 || size < 0) {
            return;
        }

        this._main.panel.height = size;

        if (!fake) {
            this._panelSize = size;
        }
    }

    /**
     * get the last size of the panel
     *
     * @returns {number}
     */
    panelGetSize()
    {
        if (this._panelSize !== undefined) {
            return this._panelSize;
        }

        if (this._originals['panelHeight']) {
            return this._originals['panelHeight'];
        }

        return this._main.panel.height;
    }

    /**
     * emit refresh styles
     * this is useful when changed style doesn't emit change because doesn't have
     * standard styles. for example, style with only `-natural-hpadding`
     * won't notify any change. so you need to call this function
     * to refresh that
     *
     * @returns {void}
     */
    _emitRefreshStyles()
    {
        let classname = this._getAPIClassname('refresh-styles');

        this.UIStyleClassAdd(classname);
        this.UIStyleClassRemove(classname);
    }

    /**
     * show panel
     *
     * @returns {void}
     */
    panelShow()
    {
        this._panelVisibility = true;

        let classname = this._getAPIClassname('no-panel');

        if (!this.UIStyleClassContain(classname)) {
            return;
        }

        // The class name should be removed before addChrome the panelBox
        // removing after can cause `st_theme_node_lookup_shadow` crash
        this.UIStyleClassRemove(classname);

        let overview = this._main.overview;
        let searchEntryParent = overview.searchEntry.get_parent();
        let panelBox = this._main.layoutManager.panelBox;

        panelBox.translation_y = 0;

        this._main.layoutManager.overviewGroup.remove_child(panelBox);
        this._main.layoutManager.addChrome(panelBox, {
            affectsStruts: true,
            trackFullscreen: true,
        });

        if (this._hidePanelWorkareasChangedSignal) {
            global.display.disconnect(this._hidePanelWorkareasChangedSignal);
            delete(this._hidePanelWorkareasChangedSignal);
        }

        if (this._hidePanelHeightSignal) {
            panelBox.disconnect(this._hidePanelHeightSignal);
            delete(this._hidePanelHeightSignal);
        }

        searchEntryParent.set_style(`margin-top: 0;`);

        // hide and show can fix windows going under panel
        panelBox.hide();
        panelBox.show();
        this._fixLookingGlassPosition();

        if (this._timeoutIds.panelHide) {
            this._glib.source_remove(this._timeoutIds.panelHide);
            delete(this._timeoutIds.panelHide);
        }
    }

    /**
     * hide panel
     *
     * @param {mode} hide mode see PANEL_HIDE_MODE. defaults to hide all
     * @param {boolean} force apply hide even if it is hidden
     *
     * @returns {void}
     */
    panelHide(mode)
    {
        this._panelVisibility = false;
        this._panelHideMode = mode;

        let overview = this._main.overview;
        let searchEntryParent = overview.searchEntry.get_parent();
        let panelBox = this._main.layoutManager.panelBox;
        let panelHeight = this._main.panel.height;
        let panelPosition = this.panelGetPosition();
        let direction = (panelPosition === PANEL_POSITION.BOTTOM) ? 1 : -1;

        if (panelBox.get_parent() === this._main.layoutManager.uiGroup) {
            this._main.layoutManager.removeChrome(panelBox);
            this._main.layoutManager.overviewGroup.insert_child_at_index(panelBox, 0);
        }

        panelBox.translation_y = (mode === PANEL_HIDE_MODE.DESKTOP) ? 0 : panelHeight * direction;

        if (panelPosition === PANEL_POSITION.TOP) {
            // when panel is hidden the first element gets too close to the top,
            // so we fix it with top margin in search entry
            let marginTop = (mode === PANEL_HIDE_MODE.ALL) ? 15 : panelHeight;
            searchEntryParent.set_style(`margin-top: ${marginTop}px;`);
        } else {
            searchEntryParent.set_style(`margin-top: 0;`);
        }

        // hide and show can fix windows going under panel
        panelBox.hide();
        panelBox.show();
        this._fixLookingGlassPosition();

        if (this._hidePanelWorkareasChangedSignal) {
            global.display.disconnect(this._hidePanelWorkareasChangedSignal);
            delete(this._hidePanelWorkareasChangedSignal);
        }

        this._hidePanelWorkareasChangedSignal = global.display.connect(
            'workareas-changed',
            () => {
                this.panelHide(this._panelHideMode);
            }
        );

        if (!this._hidePanelHeightSignal) {
            this._hidePanelHeightSignal = panelBox.connect(
                'notify::height',
                () => {
                    this.panelHide(this._panelHideMode);
                }
            );
        }

        let classname = this._getAPIClassname('no-panel');
        this.UIStyleClassAdd(classname);
        
        // update hot corners since we need to make them available
        // outside overview
        this._main.layoutManager._updateHotCorners();

        // Maximized windows will have bad maximized gap after unlock in Wayland
        // This is a Mutter issue,
        // See https://gitlab.gnome.org/GNOME/mutter/-/issues/1627
        // TODO remove after the issue is fixed on Mutter
        if (this._meta.is_wayland_compositor()) {
            let duration = this._addToAnimationDuration(180);
            this._timeoutIds.panelHide = this._glib.timeout_add(
                this._glib.PRIORITY_IDLE,
                duration,
                () => {
                    panelBox.hide();
                    panelBox.show();
                    return this._glib.SOURCE_REMOVE;
                }
            );
        }
    }

    /**
     * check whether panel is visible
     *
     * @returns {boolean}
     */
    isPanelVisible()
    {
        if (this._panelVisibility === undefined) {
            return true;
        }

        return this._panelVisibility;
    }

    /**
     * check whether dash is visible
     *
     * @returns {boolean}
     */
    isDashVisible()
    {
        return this._dashVisibility === undefined || this._dashVisibility;
    }

    /**
     * show dash
     *
     * @returns {void}
     */
    dashShow()
    {
        if (!this._main.overview.dash || this.isDashVisible()) {
            return;
        }

        this._dashVisibility = true;

        this._main.overview.dash.show();

        this._main.overview.dash.height = -1;
        this._main.overview.dash.setMaxSize(-1, -1);

        this._updateWindowPreviewOverlap();
    }

    /**
     * hide dash
     *
     * @returns {void}
     */
    dashHide()
    {
        if (!this._main.overview.dash || !this.isDashVisible()) {
            return;
        }

        this._dashVisibility = false;

        this._main.overview.dash.hide();

        this._main.overview.dash.height = 0;

        this._updateWindowPreviewOverlap();
    }

    /**
     * update window preview overlap
     *
     * @returns {void}
     */
    _updateWindowPreviewOverlap()
    {
        let wpp = this._windowPreview.WindowPreview.prototype;
        
        if (this.isDashVisible() && wpp.overlapHeightsOld) {
            wpp.overlapHeights = wpp.overlapHeightsOld;
            delete(wpp.overlapHeightsOld);
            return;
        }
        
        if (!this.isDashVisible()) {
            wpp.overlapHeightsOld = wpp.overlapHeights;
            wpp.overlapHeights = function () {
                let [top, bottom] = this.overlapHeightsOld();
                return [top + 24, bottom + 24];
            };
        }
    }

    /**
     * add class name to the UI group
     *
     * @param {string} classname class name
     *
     * @returns {void}
     */
    UIStyleClassAdd(classname)
    {
        this._main.layoutManager.uiGroup.add_style_class_name(classname);
    }

    /**
     * remove class name from UI group
     *
     * @param {string} classname class name
     *
     * @returns {void}
     */
    UIStyleClassRemove(classname)
    {
        this._main.layoutManager.uiGroup.remove_style_class_name(classname);
    }

    /**
     * check whether UI group has class name
     *
     * @param {string} classname class name
     *
     * @returns {boolean}
     */
    UIStyleClassContain(classname)
    {
        return this._main.layoutManager.uiGroup.has_style_class_name(classname);
    }

    /**
     * enable background menu
     *
     * @returns {void}
     */
    backgroundMenuEnable()
    {
        if (!this._originals['backgroundMenu']) {
            return;
        }

        this._backgroundMenu.BackgroundMenu.prototype.open
        = this._originals['backgroundMenu'];
    }

    /**
     * disable background menu
     *
     * @returns {void}
     */
    backgroundMenuDisable()
    {
        if (!this._originals['backgroundMenu']) {
            this._originals['backgroundMenu']
            = this._backgroundMenu.BackgroundMenu.prototype.open;
        }

        this._backgroundMenu.BackgroundMenu.prototype.open = () => {};
    }

    /**
     * show search
     *
     * @param {boolean} fake true means it just needs to do the job but
     *   don't need to change the search visibility status
     *
     * @returns {void}
     */
    searchEntryShow(fake)
    {
        let classname = this._getAPIClassname('no-search');

        if (!this.UIStyleClassContain(classname)) {
            return;
        }

        this.UIStyleClassRemove(classname);

        let searchEntry = this._main.overview.searchEntry;
        let searchEntryParent = searchEntry.get_parent();

        searchEntryParent.ease({
            height: searchEntry.height,
            opacity: 255,
            mode: this._clutter.AnimationMode.EASE,
            duration: 110,
            onComplete: () => {
                searchEntryParent.height = -1;
                searchEntry.ease({
                    opacity: 255,
                    mode: this._clutter.AnimationMode.EASE,
                    duration: 700,
                });
            },
        });

        if (!fake) {
            this._searchEntryVisibility = true;
        }

        this._computeWorkspacesBoxForStateChanged();
    }

    /**
     * hide search
     *
     * @param {boolean} fake true means it just needs to do the job
     *   but don't need to change the search visibility status
     *
     * @returns {void}
     */
    searchEntryHide(fake)
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-search'));

        let searchEntry = this._main.overview.searchEntry;
        let searchEntryParent = searchEntry.get_parent();

        searchEntry.ease({
            opacity: 0,
            mode: this._clutter.AnimationMode.EASE,
            duration: 50,
        });

        searchEntryParent.ease({
            height: 0,
            opacity: 0,
            mode: this._clutter.AnimationMode.EASE,
            duration: 120,
        });

        if (!fake) {
            this._searchEntryVisibility = false;
        }

        this._computeWorkspacesBoxForStateChanged();
    }

    /**
     * enable start search
     *
     * @returns {void}
     */
    startSearchEnable()
    {
        this._startSearchSignal(true);

        if (!this._originals['startSearch']) {
            return;
        }

        this._searchController.SearchController.prototype.startSearch = this._originals['startSearch'];
    }

    /**
     * disable start search
     *
     * @returns {void}
     */
    startSearchDisable()
    {
        this._startSearchSignal(false);

        if (!this._originals['startSearch']) {
            this._originals['startSearch'] = this._searchController.SearchController.prototype.startSearch
        }

        this._searchController.SearchController.prototype.startSearch = () => {};
    }

    /**
     * add search signals that needs to be show search entry when the
     * search entry is hidden
     *
     * @param {boolean} add true means add the signal, false means remove 
     *   the signal
     *
     * @returns {void}
     */
    _startSearchSignal(add)
    {
        let controller
        = this._main.overview.viewSelector ||
          this._main.overview._overview.viewSelector ||
          this._main.overview._overview.controls._searchController;

        // remove
        if (!add) {
            if (this._searchActiveSignal) {
                controller.disconnect(this._searchActiveSignal);
                this._searchActiveSignal = null;
            }
            return;
        }

        // add
        if (this._searchActiveSignal) {
            return;
        }

        this._searchActiveSignal = controller.connect('notify::search-active', () => {
            if (this._searchEntryVisibility) {
                return;
            }

            let inSearch = controller.searchActive;

            if (inSearch) {
                this.UIStyleClassAdd(this._getAPIClassname('type-to-search'));
                this.searchEntryShow(true);
            } else {
                this.UIStyleClassRemove(this._getAPIClassname('type-to-search'));
                this.searchEntryHide(true);
            }
        });
    }

    /**
     * enable OSD
     *
     * @returns {void}
     */
    OSDEnable()
    {
        if (!this._originals['osdWindowManagerShow']) {
            return;
        }

        this._main.osdWindowManager.show = this._originals['osdWindowManagerShow'];
    }

    /**
     * disable OSD
     *
     * @returns {void}
     */
    OSDDisable()
    {
        if (!this._originals['osdWindowManagerShow']) {
            this._originals['osdWindowManagerShow']
            = this._main.osdWindowManager.show;
        }

        this._main.osdWindowManager.show = () => {};
    }

    /**
     * enable workspace popup
     *
     * @returns {void}
     */
    workspacePopupEnable()
    {
        if (!this._originals['workspaceSwitcherPopupDisplay']) {
            return;
        }

        this._workspaceSwitcherPopup.WorkspaceSwitcherPopup.prototype.display
        = this._originals['workspaceSwitcherPopupDisplay']
    }

    /**
     * disable workspace popup
     *
     * @returns {void}
     */
    workspacePopupDisable()
    {
        if (!this._originals['workspaceSwitcherPopupDisplay']) {
            this._originals['workspaceSwitcherPopupDisplay']
            = this._workspaceSwitcherPopup.WorkspaceSwitcherPopup.prototype.display;
        }

        this._workspaceSwitcherPopup.WorkspaceSwitcherPopup.prototype.display = (index) => {
           return false;
        };
    }

    /**
     * show workspace switcher
     *
     * @returns {void}
     */
    workspaceSwitcherShow()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-workspace'));
        
        this._workspaceSwitcherShouldShowSetToLast();
    }

    /**
     * hide workspace switcher
     *
     * @returns {void}
     */
    workspaceSwitcherHide()
    {
        this.workspaceSwitcherShouldShow(false, true);

        // should be after `this.workspaceSwitcherShouldShow()`
        // since it checks whether it's visible or not
        this.UIStyleClassAdd(this._getAPIClassname('no-workspace'));
    }

    /**
     * check whether workspace switcher is visible
     *
     * @returns {boolean}
     */
    isWorkspaceSwitcherVisible()
    {
        return !this.UIStyleClassContain(this._getAPIClassname('no-workspace'));
    }

    /**
     * set workspace switcher to its default size
     *
     * @returns {void}
     */
    workspaceSwitcherSetDefaultSize()
    {
        let thumbnailsBox = this._main.overview._overview._controls._thumbnailsBox;
        let ThumbnailsBoxProto = this._workspaceThumbnail.ThumbnailsBox.prototype;

        if (!ThumbnailsBoxProto._initOld) {
            return;
        }

        ThumbnailsBoxProto._init = ThumbnailsBoxProto._initOld;
        delete(ThumbnailsBoxProto._initOld);

        thumbnailsBox._maxThumbnailScale = this._workspaceThumbnail.MAX_THUMBNAIL_SCALE;
    }

    /**
     * set workspace switcher size
     *
     * @param {number} size in float
     *
     * @returns {void}
     */
    workspaceSwitcherSetSize(size)
    {
        let thumbnailsBox = this._main.overview._overview._controls._thumbnailsBox;
        let ThumbnailsBoxProto = this._workspaceThumbnail.ThumbnailsBox.prototype;

        thumbnailsBox._maxThumbnailScale = size;

        if (!ThumbnailsBoxProto._initOld) {
            ThumbnailsBoxProto._initOld = ThumbnailsBoxProto._init;
        }

        ThumbnailsBoxProto._init = function(...params) {
            this._maxThumbnailScale = size;
            this._initOld(...params);
        };
    }

    /**
     * add element to stage
     *
     * @param {St.Widget} element widget 
     *
     * @returns {void}
     */
    chromeAdd(element)
    {
        this._main.layoutManager.addChrome(element, {
            affectsInputRegion : true,
            affectsStruts : false,
            trackFullscreen : true,
        });
    }

    /**
     * remove element from stage
     *
     * @param {St.Widget} element widget 
     *
     * @returns {void}
     */
    chromeRemove(element)
    {
        this._main.layoutManager.removeChrome(element);
    }

    /**
     * show activities button
     *
     * @returns {void}
     */
    activitiesButtonShow()
    {
        let activities = this._main.panel.statusArea.activities;

        if (!this.isLocked() && activities) {
            activities.container.show();
        }
    }

    /**
     * hide activities button
     *
     * @returns {void}
     */
    activitiesButtonHide()
    {
        let activities = this._main.panel.statusArea.activities;

        if (activities) {
            activities.container.hide();
        }
    }

    /**
     * show date menu
     *
     * @returns {void}
     */
    dateMenuShow()
    {
        if (!this.isLocked()) {
            this._main.panel.statusArea.dateMenu.container.show();
        }
    }

    /**
     * hide date menu
     *
     * @returns {void}
     */
    dateMenuHide()
    {
        this._main.panel.statusArea.dateMenu.container.hide();
    }

    /**
     * show keyboard layout
     *
     * @returns {void}
     */
    keyboardLayoutShow()
    {
        this._main.panel.statusArea.keyboard.container.show();
    }

    /**
     * hide keyboard layout
     *
     * @returns {void}
     */
    keyboardLayoutHide()
    {
        this._main.panel.statusArea.keyboard.container.hide();
    }

    /**
     * show accessibility menu
     *
     * @returns {void}
     */
    accessibilityMenuShow()
    {
        this._main.panel.statusArea.a11y?.container.show();
    }

    /**
     * hide accessibility menu
     *
     * @returns {void}
     */
    accessibilityMenuHide()
    {
        this._main.panel.statusArea.a11y?.container.hide();
    }

    /**
     * show quick settings menu
     *
     * @returns {void}
     */
    quickSettingsMenuShow()
    {
        if (this._shellVersion < 43) {
            return;
        }

        this._main.panel.statusArea.quickSettings.container.show();
    }

    /**
     * hide quick settings menu
     *
     * @returns {void}
     */
    quickSettingsMenuHide()
    {
        if (this._shellVersion < 43) {
            return;
        }

        this._main.panel.statusArea.quickSettings.container.hide();
    }

    /**
     * check whether lock dialog is currently showing
     *
     * @returns {boolean}
     */
    isLocked()
    {
        return this._main.sessionMode.isLocked;
    }

    /**
     * enable window picker icon
     *
     * @returns {void}
     */
    windowPickerIconEnable()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-window-picker-icon'));
    }

    /**
     * disable window picker icon
     *
     * @returns {void}
     */
    windowPickerIconDisable()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-window-picker-icon'));
    }

    /**
     * show power icon
     *
     * @returns {void}
     */
    powerIconShow()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-power-icon'));
    }

    /**
     * hide power icon
     *
     * @returns {void}
     */
    powerIconHide()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-power-icon'));
    }

    /**
     * get primary monitor information
     *
     * @returns {false|Object} false when monitor does not exist | object
     *  x: int
     *  y: int
     *  width: int
     *  height: int
     *  geometryScale: float
     */
    monitorGetInfo()
    {
        let pMonitor = this._main.layoutManager.primaryMonitor;

        if (!pMonitor) {
            return false;
        }

        return {
            'x': pMonitor.x,
            'y': pMonitor.y,
            'width': pMonitor.width,
            'height': pMonitor.height,
            'geometryScale': pMonitor.geometry_scale,
        };
    }

    /**
     * get panel position
     *
     * @returns {number} see PANEL_POSITION
     */
    panelGetPosition()
    {
        if (this._panelPosition === undefined) {
            return PANEL_POSITION.TOP;
        }

        return this._panelPosition;
    }

    /**
     * move panel position
     *
     * @param {number} position see PANEL_POSITION
     * @param {boolean} force allow to set even when the current position
     *   is the same
     *
     * @returns {void}
     */
    panelSetPosition(position, force = false)
    {
        let monitorInfo = this.monitorGetInfo();
        let panelBox = this._main.layoutManager.panelBox;

        if (!force && position === this.panelGetPosition()) {
            return;
        }

        if (position === PANEL_POSITION.TOP) {
            this._panelPosition = PANEL_POSITION.TOP;
            if (this._workareasChangedSignal) {
                global.display.disconnect(this._workareasChangedSignal);
                this._workareasChangedSignal = null;
            }
            if (this._panelHeightSignal) {
                panelBox.disconnect(this._panelHeightSignal);
                this._panelHeightSignal = null;
            }
            let topX = (monitorInfo) ? monitorInfo.x : 0;
            let topY = (monitorInfo) ? monitorInfo.y : 0;
            panelBox.set_position(topX, topY);
            this.UIStyleClassRemove(this._getAPIClassname('bottom-panel'));
            this._fixLookingGlassPosition();
            return;
        }

        this._panelPosition = PANEL_POSITION.BOTTOM;

        // only change it when a monitor detected
        // 'workareas-changed' signal will do the job on next monitor detection
        if (monitorInfo) {
            let BottomX = monitorInfo.x;
            let BottomY = monitorInfo.y + monitorInfo.height - this.panelGetSize();

            panelBox.set_position(BottomX, BottomY);
            this.UIStyleClassAdd(this._getAPIClassname('bottom-panel'));
        }

        if (!this._workareasChangedSignal) {
            this._workareasChangedSignal
            = global.display.connect('workareas-changed', () => {
                this.panelSetPosition(PANEL_POSITION.BOTTOM, true);
            });
        }

        if (!this._panelHeightSignal) {
            this._panelHeightSignal = panelBox.connect('notify::height', () => {
                this.panelSetPosition(PANEL_POSITION.BOTTOM, true);
            });
        }

        this._fixLookingGlassPosition();
    }

    /**
     * fix looking glass position
     *
     * @returns {void}
     */
    _fixLookingGlassPosition()
    {
        let lookingGlassProto = this._lookingGlass.LookingGlass.prototype;

        if (this._originals['lookingGlassResize'] === undefined) {
            this._originals['lookingGlassResize'] = lookingGlassProto._resize;
        }

        if (this.panelGetPosition() === PANEL_POSITION.TOP && this.isPanelVisible()) {

            lookingGlassProto._resize = this._originals['lookingGlassResize'];
            delete(lookingGlassProto._oldResizeMethod);
            delete(this._originals['lookingGlassResize']);

            return;
        }

        if (lookingGlassProto._oldResizeMethod === undefined) {
            lookingGlassProto._oldResizeMethod = this._originals['lookingGlassResize'];

            const Main = this._main;

            lookingGlassProto._resize = function () {
                let panelHeight = Main.layoutManager.panelBox.height;
                this._oldResizeMethod();
                this._targetY -= panelHeight;
                this._hiddenY -= panelHeight;
            };
        }
    }

    /**
     * enable panel notification icon
     *
     * @returns {void}
     */
    panelNotificationIconEnable()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-panel-notification-icon'));
    }

    /**
     * disable panel notification icon
     *
     * @returns {void}
     */
    panelNotificationIconDisable()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-panel-notification-icon'));
    }

    /**
     * disconnect all clock menu position signals 
     *
     * @returns {void}
     */
    _disconnectClockMenuPositionSignals()
    {
        let panelBoxs = [
            this._main.panel._centerBox,
            this._main.panel._rightBox,
            this._main.panel._leftBox,
        ];

        if (this._clockMenuPositionSignals) {
            for (let i = 0; i <= 2; i++) {
                panelBoxs[i].disconnect(this._clockMenuPositionSignals[i]);
            }
            delete(this._clockMenuPositionSignals);
        }
    }
     
    /**
     * set the clock menu position to default 
     *
     * @returns {void}
     */
    clockMenuPositionSetDefault()
    {
        this.clockMenuPositionSet(0, 0);
        this._disconnectClockMenuPositionSignals();
    }

    /**
     * set the clock menu position
     *
     * @param {number} pos see PANEL_BOX_POSITION
     * @param {number} offset starts from 0 
     *
     * @returns {void}
     */
    clockMenuPositionSet(pos, offset)
    {
        let dateMenu = this._main.panel.statusArea.dateMenu;

        let panelBoxs = [
            this._main.panel._centerBox,
            this._main.panel._rightBox,
            this._main.panel._leftBox,
        ];
        
        this._disconnectClockMenuPositionSignals();

        let fromPos = -1;
        let fromIndex = -1;
        let toIndex = -1;
        let childLength = 0;
        for (let i = 0; i <= 2; i++) {
            let child = panelBoxs[i].get_children();
            let childIndex = child.indexOf(dateMenu.container);
            if (childIndex !== -1) {
                fromPos = i;
                fromIndex = childIndex;
                childLength = panelBoxs[pos].get_children().length;
                toIndex = (offset > childLength) ? childLength : offset;
                break;
            }
        }

        // couldn't find the from and to position because it has been removed
        if (fromPos === -1 || fromIndex === -1 || toIndex === -1) {
            return;
        }

        if (pos === fromPos && toIndex === fromIndex) {
            return;
        }

        panelBoxs[fromPos].remove_actor(dateMenu.container);
        panelBoxs[pos].insert_child_at_index(dateMenu.container, toIndex);

        if (this.isLocked()) {
            this.dateMenuHide();
        }
        
        if (!this._clockMenuPositionSignals) {
            this._clockMenuPositionSignals = [null, null, null];
            for (let i = 0; i <= 2; i++) {
                this._clockMenuPositionSignals[i] = panelBoxs[i].connect(
                    'actor-added',
                    () => {
                        this.clockMenuPositionSet(pos, offset);
                    }
                );
            }
        }
    }

    /**
     * enable show apps button
     *
     * @returns {void}
     */
    showAppsButtonEnable()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-show-apps-button'));
    }

    /**
     * disable show apps button
     *
     * @returns {void}
     */
    showAppsButtonDisable()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-show-apps-button'));
    }

    /**
     * set animation speed as default
     *
     * @returns {void}
     */
    animationSpeedSetDefault()
    {
        if (this._originals['StSlowDownFactor'] === undefined) {
            return;
        }

        this._st.Settings.get().slow_down_factor = this._originals['StSlowDownFactor'];
    }

    /**
     * change animation speed
     *
     * @param {number} factor in float. bigger number means slower
     *
     * @returns {void}
     */
    animationSpeedSet(factor)
    {
        if (this._originals['StSlowDownFactor'] === undefined) {
            this._originals['StSlowDownFactor']
            = this._st.Settings.get().slow_down_factor;
        }

        this._st.Settings.get().slow_down_factor = factor;
    }

    /**
     * set the enable animation as default
     *
     * @returns {void}
     */
    enableAnimationsSetDefault()
    {
        if (this._originals['enableAnimations'] === undefined) {
            return;
        }

        let status = this._originals['enableAnimations'];

        this._interfaceSettings.set_boolean('enable-animations', status);
    }

    /**
     * set the enable animation status
     *
     * @param {boolean} status true to enable, false otherwise
     *
     * @returns {void}
     */
    enableAnimationsSet(status)
    {
        if (this._originals['enableAnimations'] ===  undefined) {
            this._originals['enableAnimations']
            = this._interfaceSettings.get_boolean('enable-animations');
        }

        this._interfaceSettings.set_boolean('enable-animations', status);
    }

    /**
     * enable focus when window demands attention happens
     *
     * @returns {void}
     */
    windowDemandsAttentionFocusEnable()
    {
        if (
            this._displayWindowDemandsAttentionSignal ||
            this._displayWindowMarkedUrgentSignal
        ) {
            return;
        }

        let display = global.display;

        let demandFunction = (display, window) => {
            if (!window || window.has_focus() || window.is_skip_taskbar()) {
                return;
            }
            this._main.activateWindow(window);
        };

        this._displayWindowDemandsAttentionSignal
        = display.connect('window-demands-attention', demandFunction);
        this._displayWindowMarkedUrgentSignal
        = display.connect('window-marked-urgent', demandFunction);

        // since removing '_windowDemandsAttentionId' doesn't have any effect
        // we remove the original signal and re-connect it on disable
        let signalId = this._getSignalId(global.display, 'window-demands-attention');
        let signalId2 = this._getSignalId(global.display, 'window-marked-urgent');
        display.disconnect(signalId);
        display.disconnect(signalId2);
    }

    /**
     * disable focus when window demands attention happens
     *
     * @returns {void}
     */
    windowDemandsAttentionFocusDisable()
    {
        if (
            !this._displayWindowDemandsAttentionSignal ||
            !this._displayWindowMarkedUrgentSignal
        ) {
            return;
        }

        let display = global.display;

        display.disconnect(this._displayWindowDemandsAttentionSignal);
        display.disconnect(this._displayWindowMarkedUrgentSignal);
        this._displayWindowDemandsAttentionSignal = null;
        this._displayWindowMarkedUrgentSignal = null;

        let wah = this._main.windowAttentionHandler;
        wah._windowDemandsAttentionId = display.connect(
            'window-demands-attention',
            wah._onWindowDemandsAttention.bind(wah)
        );
        wah._windowDemandsAttentionId = display.connect(
            'window-marked-urgent',
            wah._onWindowDemandsAttention.bind(wah)
        );
    }

    /**
     * set startup status
     *
     * @param {number} status see SHELL_STATUS for available status
     *
     * @returns {void}
     */
    startupStatusSet(status)
    {
        let sessionMode = this._main.sessionMode;
        let layoutManager = this._main.layoutManager;

        if (!layoutManager._startingUp) {
            return;
        }

        if (this._originals['sessionModeHasOverview'] === undefined) {
            this._originals['sessionModeHasOverview'] = sessionMode.hasOverview;
        }

        let ControlsState = this._overviewControls.ControlsState;
        let Controls = this._main.overview._overview.controls;

        switch (status) {

            case SHELL_STATUS.NONE:
                sessionMode.hasOverview = false;
                layoutManager.startInOverview = false;
                Controls._stateAdjustment.value = ControlsState.HIDDEN;
                break;

            case SHELL_STATUS.OVERVIEW:
            default:
                sessionMode.hasOverview = true;
                layoutManager.startInOverview = true;
                break;
        }

        if (!this._startupCompleteSignal) {
            this._startupCompleteSignal
            = layoutManager.connect('startup-complete', () => {
                sessionMode.hasOverview = this._originals['sessionModeHasOverview'];
            });
        }
    }

    /**
     * set startup status to default
     *
     * @returns {void}
     */
    startupStatusSetDefault()
    {
        if (this._originals['sessionModeHasOverview'] === undefined) {
            return;
        }

        if (this._startupCompleteSignal) {
            this._main.layoutManager.disconnect(this._startupCompleteSignal);
        }
    }

    /**
     * set dash icon size to default
     *
     * @returns {void}
     */
    dashIconSizeSetDefault()
    {
        let classnameStarter = this._getAPIClassname('dash-icon-size');

        DASH_ICON_SIZES.forEach(size => {
            this.UIStyleClassRemove(classnameStarter + size);
        });
    }

    /**
     * set dash icon size
     *
     * @param {number} size in pixels
     *   see DASH_ICON_SIZES for available sizes
     *
     * @returns {void}
     */
    dashIconSizeSet(size)
    {
        this.dashIconSizeSetDefault();

        if (!DASH_ICON_SIZES.includes(size)) {
            return;
        }

        let classnameStarter = this._getAPIClassname('dash-icon-size');

        this.UIStyleClassAdd(classnameStarter + size);
    }

    /**
     * change ControlsManagerLayout._computeWorkspacesBoxForState
     * base on the current state
     *
     * @returns {void}
     */
    _computeWorkspacesBoxForStateChanged()
    {
        let controlsLayout = this._main.overview._overview._controls.layout_manager;

        if (!this._originals['computeWorkspacesBoxForState']) {
            this._originals['computeWorkspacesBoxForState']
            = controlsLayout._computeWorkspacesBoxForState;
        }

        controlsLayout._computeWorkspacesBoxForState = (state, box, searchHeight, ...args) => {

            let inAppGrid = state === this._overviewControls.ControlsState.APP_GRID;

            if (inAppGrid && !this._searchEntryVisibility) {
                // We need some spacing on top of workspace box in app grid
                // when the search entry is not visible.
                searchHeight = 40;
            }

            box = this._originals['computeWorkspacesBoxForState'].call(
                controlsLayout, state, box, searchHeight, ...args);

            if (inAppGrid && this._workspacesInAppGridHeight !== undefined) {
                box.set_size(
                    box.get_width(),
                    this._workspacesInAppGridHeight
                );
            }

            return box;
        };

        // Since workspace background has shadow around it, it can cause
        // unwanted shadows in app grid when the workspace height is 0.
        // so we are removing the shadow when we are in app grid
        if (!this._appButtonForComputeWorkspacesSignal) {
            this._appButtonForComputeWorkspacesSignal =
            this._main.overview.dash.showAppsButton.connect(
                'notify::checked',
                () => {
                    let checked = this._main.overview.dash.showAppsButton.checked;
                    let classname = this._getAPIClassname('no-workspaces-in-app-grid');
                    if (checked) {
                        this.UIStyleClassAdd(classname);
                    } else {
                        this.UIStyleClassRemove(classname);
                    }
                }
            );
        }
    }

    /**
     * change ControlsManagerLayout._computeWorkspacesBoxForState to its default
     *
     * @returns {void}
     */
    _computeWorkspacesBoxForStateSetDefault()
    {
        if (!this._originals['computeWorkspacesBoxForState']) {
            return;
        }

        let controlsLayout = this._main.overview._overview._controls.layout_manager;

        controlsLayout._computeWorkspacesBoxForState
        = this._originals['computeWorkspacesBoxForState'];
        
        if (this._appButtonForComputeWorkspacesSignal) {
            let showAppsButton = this._main.overview.dash.showAppsButton;
            showAppsButton.disconnect(this._appButtonForComputeWorkspacesSignal);
            delete(this._appButtonForComputeWorkspacesSignal);
            this.UIStyleClassRemove(this._getAPIClassname('no-workspaces-in-app-grid'));
        }
    }

    /**
     * disable workspaces in app grid
     *
     * @returns {void}
     */
    workspacesInAppGridDisable()
    {
        this._workspacesInAppGridHeight = 0;
        this._computeWorkspacesBoxForStateChanged();
    }

    /**
     * enable workspaces in app grid
     *
     * @returns {void}
     */
    workspacesInAppGridEnable()
    {
        if (this._workspacesInAppGridHeight === undefined) {
            return;
        }

        delete(this._workspacesInAppGridHeight);
        this._computeWorkspacesBoxForStateChanged();
    }

    /**
     * change notification banner position
     *
     * @param {number} pos
     *   see XY_POSITION for available positions
     *
     * @returns {void}
     */
    notificationBannerPositionSet(pos)
    {
        let messageTray = this._main.messageTray;
        let bannerBin = messageTray._bannerBin;

        if (this._originals['bannerAlignmentX'] === undefined) {
            this._originals['bannerAlignmentX'] = messageTray.bannerAlignment;
        }

        if (this._originals['bannerAlignmentY'] === undefined) {
            this._originals['bannerAlignmentY'] = bannerBin.get_y_align();
        }

        if (this._originals['hideNotification'] === undefined) {
            this._originals['hideNotification'] = messageTray._hideNotification;
        }

        // TOP
        messageTray._hideNotification = this._originals['hideNotification'];

        bannerBin.set_y_align(this._clutter.ActorAlign.START);

        if (pos === XY_POSITION.TOP_START) {
            messageTray.bannerAlignment = this._clutter.ActorAlign.START;
            return;
        }

        if (pos === XY_POSITION.TOP_END) {
            messageTray.bannerAlignment = this._clutter.ActorAlign.END;
            return;
        }

        if (pos === XY_POSITION.TOP_CENTER) {
            messageTray.bannerAlignment = this._clutter.ActorAlign.CENTER;
            return;
        }

        // BOTTOM

        // >>
        // This block is going to fix the animation when the notification is
        // in bottom area
        // this is the same function from (ui.messageTray.messageTray._hideNotification)
        // with clutter animation mode set to EASE.
        // because the EASE_OUT_BACK (original code) causes glitch when
        // the tray is on bottom 
        const State = this._messageTray.State;
        const ANIMATION_TIME = this._messageTray.ANIMATION_TIME;
        const Clutter = this._clutter;

        messageTray._hideNotification = function (animate) {
            this._notificationFocusGrabber.ungrabFocus();
            this._banner.disconnectObject(this);
            this._resetNotificationLeftTimeout();
            this._bannerBin.remove_all_transitions();

            if (animate) {
                this._notificationState = State.HIDING;
                this._bannerBin.ease({
                    opacity: 0,
                    duration: ANIMATION_TIME,
                    mode: Clutter.AnimationMode.EASE,
                });
                this._bannerBin.ease({
                    opacity: 0,
                    y: this._bannerBin.height,
                    duration: ANIMATION_TIME,
                    mode: Clutter.AnimationMode.EASE,
                    onComplete: () => {
                        this._notificationState = State.HIDDEN;
                        this._hideNotificationCompleted();
                        this._updateState();
                    },
                });
            } else {
                this._bannerBin.y = this._bannerBin.height;
                this._bannerBin.opacity = 0;
                this._notificationState = State.HIDDEN;
                this._hideNotificationCompleted();
            }
        }
        // <<

        bannerBin.set_y_align(this._clutter.ActorAlign.END);

        if (pos === XY_POSITION.BOTTOM_START) {
            messageTray.bannerAlignment = this._clutter.ActorAlign.START;
            return;
        }

        if (pos === XY_POSITION.BOTTOM_END) {
            messageTray.bannerAlignment = this._clutter.ActorAlign.END;
            return;
        }

        if (pos === XY_POSITION.BOTTOM_CENTER) {
            messageTray.bannerAlignment = this._clutter.ActorAlign.CENTER;
            return;
        }
    }

    /**
     * set notification banner position to default position
     *
     * @returns {void}
     */
    notificationBannerPositionSetDefault()
    {
        if (this._originals['bannerAlignmentX'] === undefined ||
            this._originals['bannerAlignmentY'] === undefined ||
            this._originals['hideNotification'] === undefined
        ) {
            return;
        }

        let messageTray = this._main.messageTray;
        let bannerBin = messageTray._bannerBin;

        messageTray.bannerAlignment = this._originals['bannerAlignmentX'];
        bannerBin.set_y_align(this._originals['bannerAlignmentY']);
        messageTray._hideNotification = this._originals['hideNotification'];
    }

    /**
     * set the workspace switcher to always/never show
     *
     * @param {boolean} show true for always show, false for never show
     * @param {boolean} fake true means set the current should show status
     *
     * @returns {void}
     */
    workspaceSwitcherShouldShow(shouldShow = true, fake = false)
    {
        if (!fake) {
            this._shouldShow = shouldShow;
        }

        if (!this.isWorkspaceSwitcherVisible()) {
            return;
        }

        let ThumbnailsBoxProto = this._workspaceThumbnail.ThumbnailsBox.prototype;

        if (!this._originals['updateShouldShow']) {
            this._originals['updateShouldShow'] = ThumbnailsBoxProto._updateShouldShow;
        }

        ThumbnailsBoxProto._updateShouldShow = function () {
            if (this._shouldShow === shouldShow) {
                return;
            }
            this._shouldShow = shouldShow;
            this.notify('should-show');
        };
    }

    /**
     * set the always show workspace switcher status to last real status
     *
     * @returns {void}
     */
    _workspaceSwitcherShouldShowSetToLast()
    {
        if (this._shouldShow === undefined) {
            this.workspaceSwitcherShouldShowSetDefault();
            return;
        }

        this.workspaceSwitcherShouldShow(this._shouldShow);
    }

    /**
     * set the always show workspace switcher status to default
     *
     * @returns {void}
     */
    workspaceSwitcherShouldShowSetDefault()
    {
        if (!this._originals['updateShouldShow'] || !this.isWorkspaceSwitcherVisible()) {
            return;
        }

        let ThumbnailsBoxProto = this._workspaceThumbnail.ThumbnailsBox.prototype;
        ThumbnailsBoxProto._updateShouldShow = this._originals['updateShouldShow'];
        delete(this._originals['updateShouldShow']);
        delete(this._shouldShow);
    }

    /**
     * set panel button hpadding to default
     *
     * @returns {void}
     */
    panelButtonHpaddingSetDefault()
    {
        if (this._panelButtonHpaddingSize === undefined) {
            return;
        }

        let classnameStarter = this._getAPIClassname('panel-button-padding-size');
        this.UIStyleClassRemove(classnameStarter + this._panelButtonHpaddingSize);
        this._emitRefreshStyles();

        delete this._panelButtonHpaddingSize;
    }

    /**
     * set panel button hpadding size
     *
     * @param {number} size in pixels (0 - 60)
     *
     * @returns {void}
     */
    panelButtonHpaddingSizeSet(size)
    {
        this.panelButtonHpaddingSetDefault();

        if (size < 0 || size > 60) {
            return;
        }

        this._panelButtonHpaddingSize = size;

        let classnameStarter = this._getAPIClassname('panel-button-padding-size');
        this.UIStyleClassAdd(classnameStarter + size);
        this._emitRefreshStyles();
    }

    /**
     * set panel indicator padding to default
     *
     * @returns {void}
     */
    panelIndicatorPaddingSetDefault()
    {
        if (this._panelIndicatorPaddingSize === undefined) {
            return;
        }

        let classnameStarter = this._getAPIClassname('panel-indicator-padding-size');
        this.UIStyleClassRemove(classnameStarter + this._panelIndicatorPaddingSize);
        this._emitRefreshStyles();

        delete this._panelIndicatorPaddingSize;
    }

    /**
     * set panel indicator padding size
     *
     * @param {number} size in pixels (0 - 60)
     *
     * @returns {void}
     */
    panelIndicatorPaddingSizeSet(size)
    {
        this.panelIndicatorPaddingSetDefault();

        if (size < 0 || size > 60) {
            return;
        }

        this._panelIndicatorPaddingSize = size;

        let classnameStarter = this._getAPIClassname('panel-indicator-padding-size');
        this.UIStyleClassAdd(classnameStarter + size);
        this._emitRefreshStyles();
    }

    /**
     * get window preview prototype
     *
     * @returns {Object}
     */
    _windowPreviewGetPrototype()
    {
        return this._windowPreview.WindowPreview.prototype;
    }

    /**
     * enable window preview caption
     *
     * @returns {void}
     */
    windowPreviewCaptionEnable()
    {
        if (!this._originals['windowPreviewGetCaption']) {
            return;
        }

        let windowPreviewProto = this._windowPreviewGetPrototype();
        windowPreviewProto._getCaption = this._originals['windowPreviewGetCaption'];

        this.UIStyleClassRemove(this._getAPIClassname('no-window-caption'));
    }

    /**
     * disable window preview caption
     *
     * @returns {void}
     */
    windowPreviewCaptionDisable()
    {
        let windowPreviewProto = this._windowPreviewGetPrototype();

        if (!this._originals['windowPreviewGetCaption']) {
            this._originals['windowPreviewGetCaption'] = windowPreviewProto._getCaption;
        }

        windowPreviewProto._getCaption = () => {
            return '';
        };

        this.UIStyleClassAdd(this._getAPIClassname('no-window-caption'));
    }

    /**
     * set workspace background border radius to default size
     *
     * @returns {void}
     */
    workspaceBackgroundRadiusSetDefault()
    {
        if (this._workspaceBackgroundRadiusSize === undefined) {
            return;
        }

        let workspaceBackgroundProto = this._workspace.WorkspaceBackground.prototype;

        workspaceBackgroundProto._updateBorderRadius
        = this._originals['workspaceBackgroundUpdateBorderRadius'];

        let classnameStarter = this._getAPIClassname('workspace-background-radius-size');
        this.UIStyleClassRemove(classnameStarter + this._workspaceBackgroundRadiusSize);

        delete this._workspaceBackgroundRadiusSize;
    }

    /**
     * set workspace background border radius size
     *
     * @param {number} size in pixels (0 - 60)
     *
     * @returns {void}
     */
    workspaceBackgroundRadiusSet(size)
    {
        if (size < 0 || size > 60) {
            return;
        }

        this.workspaceBackgroundRadiusSetDefault();

        let workspaceBackgroundProto = this._workspace.WorkspaceBackground.prototype;

        if (!this._originals['workspaceBackgroundUpdateBorderRadius']) {
            this._originals['workspaceBackgroundUpdateBorderRadius']
            = workspaceBackgroundProto._updateBorderRadius;
        }

        const Util = this._util;
        const St = this._st;

        workspaceBackgroundProto._updateBorderRadius = function () {
            const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
            const cornerRadius = scaleFactor * size;

            const backgroundContent = this._bgManager.backgroundActor.content;
            backgroundContent.rounded_clip_radius = 
                Util.lerp(0, cornerRadius, this._stateAdjustment.value);
        }

        this._workspaceBackgroundRadiusSize = size;

        let classnameStarter = this._getAPIClassname('workspace-background-radius-size');
        this.UIStyleClassAdd(classnameStarter + size);
    }

    /**
     * enable workspace wraparound
     *
     * @returns {void}
     */
    workspaceWraparoundEnable()
    {
        let metaWorkspaceProto = this._meta.Workspace.prototype;

        if (!this._originals['metaWorkspaceGetNeighbor']) {
            this._originals['metaWorkspaceGetNeighbor']
            = metaWorkspaceProto.get_neighbor;
        }

        const Meta = this._meta;

        metaWorkspaceProto.get_neighbor = function (dir) {

            let index = this.index();
            let lastIndex = global.workspace_manager.n_workspaces - 1;
            let neighborIndex;

            if (dir === Meta.MotionDirection.UP || dir === Meta.MotionDirection.LEFT) {
                // prev
                neighborIndex = (index > 0) ? index - 1 : lastIndex;
            } else {
                // next
                neighborIndex = (index < lastIndex) ? index + 1 : 0;
            }

            return global.workspace_manager.get_workspace_by_index(neighborIndex);
        };
    }

    /**
     * disable workspace wraparound
     *
     * @returns {void}
     */
    workspaceWraparoundDisable()
    {
        if (!this._originals['metaWorkspaceGetNeighbor']) {
            return;
        }

        let metaWorkspaceProto = this._meta.Workspace.prototype;
        metaWorkspaceProto.get_neighbor = this._originals['metaWorkspaceGetNeighbor'];
    }

    /**
     * enable window preview close button
     *
     * @returns {void}
     */
    windowPreviewCloseButtonEnable()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-window-close'));
    }

    /**
     * disable window preview close button
     *
     * @returns {void}
     */
    windowPreviewCloseButtonDisable()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-window-close'));
    }

    /**
     * enable ripple box
     *
     * @returns {void}
     */
    rippleBoxEnable()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-ripple-box'));
    }

    /**
     * disable ripple box
     *
     * @returns {void}
     */
    rippleBoxDisable()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-ripple-box'));
    }

    /**
     * unblock overlay key
     *
     * @returns {void}
     */
    unblockOverlayKey()
    {
        if (!this._overlayKeyOldSignalId) {
            return;
        }

        this._gobject.signal_handler_unblock(
            global.display,
            this._overlayKeyOldSignalId
        );

        delete(this._overlayKeyOldSignalId);
    }

    /**
     * block overlay key
     *
     * @returns {void}
     */
    blockOverlayKey()
    {
        this._overlayKeyOldSignalId = this._getSignalId(global.display, 'overlay-key');

        if (!this._overlayKeyOldSignalId) {
            return;
        }

        this._gobject.signal_handler_block(global.display, this._overlayKeyOldSignalId);
    }

    /**
     * enable double super press to toggle app grid
     *
     * @returns {void}
     */
    doubleSuperToAppGridEnable()
    {
        if (this._isDoubleSuperToAppGrid === true) {
            return;
        }

        if (!this._overlayKeyNewSignalId) {
            return;
        }

        global.display.disconnect(this._overlayKeyNewSignalId);
        delete(this._overlayKeyNewSignalId);
        this.unblockOverlayKey();

        this._isDoubleSuperToAppGrid = true;
    }

    /**
     * disable double super press to toggle app grid
     *
     * @returns {void}
     */
    doubleSuperToAppGridDisable()
    {
        if (this._isDoubleSuperToAppGrid === false) {
            return;
        }

        this.blockOverlayKey();

        this._overlayKeyNewSignalId = global.display.connect('overlay-key', () => {
            this._main.overview.toggle();
        });

        this._isDoubleSuperToAppGrid = false;
    }

    /**
     * disable the removal of switcher popup delay
     *
     * @returns {void}
     */
    switcherPopupDelaySetDefault()
    {
        let SwitcherPopupProto = this._switcherPopup.SwitcherPopup.prototype;

        if (!SwitcherPopupProto.showOld) {
            return;
        }

        SwitcherPopupProto.show = SwitcherPopupProto.showOld;
        delete(SwitcherPopupProto.showOld);
    }

    /**
     * enable the removal of switcher popup delay
     *
     * @returns {void}
     */
    removeSwitcherPopupDelay()
    {
        let SwitcherPopupProto = this._switcherPopup.SwitcherPopup.prototype;

        SwitcherPopupProto.showOld = SwitcherPopupProto.show;

        SwitcherPopupProto.show = function (...args) {
            let res = this.showOld(...args);
            if (res) {
                this._showImmediately();
            }
            return res;
        };
    }

    /**
     * set default OSD position
     *
     * @returns {void}
     */
    osdPositionSetDefault()
    {
        if (!this._originals['osdWindowShow']) {
            return;
        }

        let osdWindowProto = this._osdWindow.OsdWindow.prototype;

        osdWindowProto.show = this._originals['osdWindowShow'];

        delete(osdWindowProto._oldShow);
        delete(this._originals['osdWindowShow']);
        
        if (
            this._originals['osdWindowXAlign'] !== undefined && 
            this._originals['osdWindowYAlign'] !== undefined
        ) {
            let osdWindows = this._main.osdWindowManager._osdWindows;
            osdWindows.forEach(osdWindow => {
                osdWindow.x_align = this._originals['osdWindowXAlign'];
                osdWindow.y_align = this._originals['osdWindowYAlign'];
            });
            delete(this._originals['osdWindowXAlign']);
            delete(this._originals['osdWindowYAlign']);
        }

        this.UIStyleClassRemove(this._getAPIClassname('osd-position-top'));
        this.UIStyleClassRemove(this._getAPIClassname('osd-position-bottom'));
        this.UIStyleClassRemove(this._getAPIClassname('osd-position-center'));
    }

    /**
     * set OSD position
     *
     * @param int pos position XY_POSITION
     *
     * @returns {void}
     */
    osdPositionSet(pos)
    {
        let osdWindowProto = this._osdWindow.OsdWindow.prototype;

        if (!this._originals['osdWindowShow']) {
            this._originals['osdWindowShow'] = osdWindowProto.show;
        }

        if (
            this._originals['osdWindowXAlign'] === undefined || 
            this._originals['osdWindowYAlign'] === undefined
        ) {
            let osdWindows = this._main.osdWindowManager._osdWindows;
            this._originals['osdWindowXAlign'] = osdWindows[0].x_align;
            this._originals['osdWindowYAlign'] = osdWindows[0].y_align;
        }

        if (osdWindowProto._oldShow === undefined) {
            osdWindowProto._oldShow = this._originals['osdWindowShow'];
        }

        let [xAlign, yAlign] = this._xyAlignGet(pos);
        osdWindowProto.show = function () {
            this.x_align = xAlign;
            this.y_align = yAlign;
            this._oldShow();
        };

        if (
            pos === XY_POSITION.TOP_START ||
            pos === XY_POSITION.TOP_CENTER ||
            pos === XY_POSITION.TOP_END
        ) {
            this.UIStyleClassAdd(this._getAPIClassname('osd-position-top'));
        }
        
        if (
            pos === XY_POSITION.BOTTOM_START ||
            pos === XY_POSITION.BOTTOM_CENTER ||
            pos === XY_POSITION.BOTTOM_END
        ) {
            this.UIStyleClassAdd(this._getAPIClassname('osd-position-bottom'));
        }
        
        if (
            pos === XY_POSITION.CENTER_START ||
            pos === XY_POSITION.CENTER_CENTER ||
            pos === XY_POSITION.CENTER_END
        ) {
            this.UIStyleClassAdd(this._getAPIClassname('osd-position-center'));
        }
    }

    /**
     * show weather in date menu
     *
     * @returns {void}
     */
    weatherShow()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-weather'));
    }

    /**
     * hide weather in date menu
     *
     * @returns {void}
     */
    weatherHide()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-weather'));
    }

    /**
     * show world clocks in date menu
     *
     * @returns {void}
     */
    worldClocksShow()
    {
        if (!this._originals['clocksItemSync']) {
            return;
        }

        let clocksItem = this._main.panel.statusArea.dateMenu._clocksItem;

        clocksItem._sync = this._originals['clocksItemSync'];
        delete(this._originals['clocksItemSync']);

        clocksItem._sync();
    }

    /**
     * hide world clocks in date menu
     *
     * @returns {void}
     */
    worldClocksHide()
    {
        let clocksItem = this._main.panel.statusArea.dateMenu._clocksItem;

        if (!this._originals['clocksItemSync']) {
            this._originals['clocksItemSync'] = clocksItem._sync;
        }

        clocksItem._sync = function () {
            this.visible = false;
        };

        clocksItem._sync();
    }

    /**
     * show events button in date menu
     *
     * @returns {void}
     */
    eventsButtonShow()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-events-button'));
    }

    /**
     * hide events button in date menu
     *
     * @returns {void}
     */
    eventsButtonHide()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-events-button'));
    }

    /**
     * show calendar in date menu
     *
     * @returns {void}
     */
    calendarShow()
    {
        this._main.panel.statusArea.dateMenu._calendar.show();
    }

    /**
     * hide calendar in date menu
     *
     * @returns {void}
     */
    calendarHide()
    {
        this._main.panel.statusArea.dateMenu._calendar.hide();
    }

    /**
     * set default panel icon size
     *
     * @returns {void}
     */
    panelIconSetDefaultSize()
    {
        if (this._panelIconSize === undefined || !this._originals['panelIconSize']) {
            return;
        }

        let classnameStarter = this._getAPIClassname('panel-icon-size');
        this.UIStyleClassRemove(classnameStarter + this._panelIconSize);
        this._emitRefreshStyles();

        let defaultSize = this._originals['panelIconSize'];
        this._changeDateMenuIndicatorIconSize(defaultSize);

        delete(this._panelIconSize);
    }

    /**
     * set panel icon size
     *
     * @param {number} size 1-60
     *
     * @returns {void}
     */
    panelIconSetSize(size)
    {
        if (size < 1 || size > 60) {
            return;
        }

        if (!this._originals['panelIconSize']) {
            this._originals['panelIconSize'] = this._panel.PANEL_ICON_SIZE;
        }

        let classnameStarter = this._getAPIClassname('panel-icon-size');
        this.UIStyleClassRemove(classnameStarter + this.panelIconGetSize());
        this.UIStyleClassAdd(classnameStarter + size);
        this._emitRefreshStyles();

        this._changeDateMenuIndicatorIconSize(size);

        this._panelIconSize = size;
    }

    /**
     * change date menu indicator icon size
     *
     * @param {number} size
     *
     * @returns {void}
     */
    _changeDateMenuIndicatorIconSize(size)
    {
        let dateMenu = this._main.panel.statusArea.dateMenu;

        // we get set_icon_size is not a function in some setups
        // in case the date menu has been removed or not created
        if (
            dateMenu &&
            dateMenu._indicator &&
            dateMenu._indicator.set_icon_size
        ) {
            dateMenu._indicator.set_icon_size(size);
        }
    }

    /**
     * get panel icon size
     *
     * @returns {void}
     */
    panelIconGetSize()
    {
        if (this._panelIconSize !== undefined) {
            return this._panelIconSize;
        }

        return this._panel.PANEL_ICON_SIZE;
    }

    /**
     * show dash separator
     *
     * @returns {void}
     */
    dashSeparatorShow()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-dash-separator'));
    }

    /**
     * hide dash separator
     *
     * @returns {void}
     */
    dashSeparatorHide()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-dash-separator'));
    }

    /**
     * get looking glass size
     *
     * @returns {array}
     *  width: int
     *  height: int
     */
    _lookingGlassGetSize()
    {
        let lookingGlass = this._main.createLookingGlass();

        return [lookingGlass.width, lookingGlass.height];
    }

    /**
     * set default looking glass size
     *
     * @returns {void}
     */
    lookingGlassSetDefaultSize()
    {
        if (!this._lookingGlassShowSignal) {
            return;
        }

        this._main.lookingGlass.disconnect(this._lookingGlassShowSignal);

        delete(this._lookingGlassShowSignal);
        delete(this._lookingGlassOriginalSize);
        delete(this._monitorsChangedSignal);
    }

    /**
     * set looking glass size
     *
     * @param {number} width in float
     * @param {number} height in float
     *
     * @returns {void}
     */
    lookingGlassSetSize(width, height)
    {
        let lookingGlass = this._main.createLookingGlass();

        if (!this._lookingGlassOriginalSize) {
            this._lookingGlassOriginalSize = this._lookingGlassGetSize();
        }

        if (this._lookingGlassShowSignal) {
            lookingGlass.disconnect(this._lookingGlassShowSignal);
            delete(this._lookingGlassShowSignal);
        }

        this._lookingGlassShowSignal = lookingGlass.connect('show', () => {
            let [, currentHeight] = this._lookingGlassGetSize();
            let [originalWidth, originalHeight] = this._lookingGlassOriginalSize;

            let monitorInfo = this.monitorGetInfo();

            let dialogWidth
            =   (width !== null)
            ?   monitorInfo.width * width
            :   originalWidth;

            let x = monitorInfo.x + (monitorInfo.width - dialogWidth) / 2;
            lookingGlass.set_x(x);

            let keyboardHeight = this._main.layoutManager.keyboardBox.height;
            let availableHeight = monitorInfo.height - keyboardHeight;
            let dialogHeight
            = (height !== null)
            ? Math.min(monitorInfo.height * height, availableHeight * 0.9)
            : originalHeight;

            let hiddenY = lookingGlass._hiddenY + currentHeight - dialogHeight;
            lookingGlass.set_y(hiddenY);
            lookingGlass._hiddenY = hiddenY;

            lookingGlass.set_size(dialogWidth, dialogHeight);
        });

        if (!this._monitorsChangedSignal) {
            this._monitorsChangedSignal = this._main.layoutManager.connect('monitors-changed',
            () => {
                    this.lookingGlassSetSize(width, height);
            });
        }
    }

    /**
     * show screenshot in window menu
     *
     * @returns {void}
     */
    screenshotInWindowMenuShow()
    {
        let windowMenuProto = this._windowMenu.WindowMenu.prototype;

        if (windowMenuProto._oldBuildMenu === undefined) {
            return;
        }

        windowMenuProto._buildMenu = this._originals['WindowMenubuildMenu'];

        delete(windowMenuProto._oldBuildMenu);
    }

    /**
     * hide screenshot in window menu
     *
     * @returns {void}
     */
    screenshotInWindowMenuHide()
    {
        let windowMenuProto = this._windowMenu.WindowMenu.prototype;

        if (!this._originals['WindowMenubuildMenu']) {
            this._originals['WindowMenubuildMenu'] = windowMenuProto._buildMenu;
        }

        if (windowMenuProto._oldBuildMenu === undefined) {
            windowMenuProto._oldBuildMenu = this._originals['WindowMenubuildMenu'];
        }

        windowMenuProto._buildMenu = function (window) {
            this._oldBuildMenu(window);
            this.firstMenuItem.hide();
        };
    }

    /**
     * set all alt tab sizes to default
     *
     * @returns {void}
     */
    _altTabSizesSetDefault()
    {
        let WindowIconProto = this._altTab.WindowIcon.prototype;
        if (WindowIconProto._initOld) {
            WindowIconProto._init = WindowIconProto._initOld;
            delete(WindowIconProto._initOld);
        }

        delete(this._altTabAPP_ICON_SIZE);
        delete(this._altTabAPP_ICON_SIZE_SMALL);
        delete(this._altTabWINDOW_PREVIEW_SIZE);
    }

    /**
     * set alt tab sizes
     *
     * @param {number|null} appIconSize
     * @param {number|null} appIconSizeSmall
     * @param {number|null} windowPreviewSize
     *
     * @returns {void}
     */
    _altTabSizesSet(appIconSize, appIconSizeSmall, windowPreviewSize)
    {
        let WindowIconProto = this._altTab.WindowIcon.prototype;
        if (!WindowIconProto._initOld) {
            WindowIconProto._initOld = WindowIconProto._init;
        }

        this._altTabAPP_ICON_SIZE ||= this._altTab.APP_ICON_SIZE;
        this._altTabAPP_ICON_SIZE_SMALL ||= this._altTab.APP_ICON_SIZE_SMALL;
        this._altTabWINDOW_PREVIEW_SIZE ||= this._altTab.WINDOW_PREVIEW_SIZE;

        const APP_ICON_SIZE = appIconSize || this._altTabAPP_ICON_SIZE;
        const APP_ICON_SIZE_SMALL = appIconSizeSmall || this._altTabAPP_ICON_SIZE_SMALL;
        const WINDOW_PREVIEW_SIZE = windowPreviewSize || this._altTabWINDOW_PREVIEW_SIZE;

        WindowIconProto._init = function(window, mode) {
            this._initOld(window, mode);
        }
    }

    /**
     * set default alt tab window preview size
     *
     * @returns {void}
     */
    altTabWindowPreviewSetDefaultSize()
    {
        if (!this._originals['altTabWindowPreviewSize']) {
            return;
        }

        this._altTabSizesSet(null, null, this._originals['altTabWindowPreviewSize']);
    }

    /**
     * set alt tab window preview size
     *
     * @param {number} size 1-512
     *
     * @returns {void}
     */
    altTabWindowPreviewSetSize(size)
    {
        if (size < 1 || size > 512) {
            return;
        }

        if (!this._originals['altTabWindowPreviewSize']) {
            this._originals['altTabWindowPreviewSize'] = this._altTab.WINDOW_PREVIEW_SIZE;
        }

        this._altTabSizesSet(null, null, size);
    }

    /**
     * set default alt tab small icon size
     *
     * @returns {void}
     */
    altTabSmallIconSetDefaultSize()
    {
        if (!this._originals['altTabAppIconSizeSmall']) {
            return;
        }

        this._altTabSizesSet(null, this._originals['altTabAppIconSizeSmall'], null);
    }

    /**
     * set alt tab small icon size
     *
     * @param {number} size 1-512
     *
     * @returns {void}
     */
    altTabSmallIconSetSize(size)
    {
        if (size < 1 || size > 512) {
            return;
        }

        if (!this._originals['altTabAppIconSizeSmall']) {
            this._originals['altTabAppIconSizeSmall'] = this._altTab.APP_ICON_SIZE_SMALL;
        }

        this._altTabSizesSet(null, size, null);
    }

    /**
     * set default alt tab icon size
     *
     * @returns {void}
     */
    altTabIconSetDefaultSize()
    {
        if (!this._originals['altTabAppIconSize']) {
            return;
        }

        this._altTabSizesSet(this._originals['altTabAppIconSize'], null, null);
    }

    /**
     * set alt tab icon size
     *
     * @param {number} size 1-512
     *
     * @returns {void}
     */
    altTabIconSetSize(size)
    {
        if (size < 1 || size > 512) {
            return;
        }

        if (!this._originals['altTabAppIconSize']) {
            this._originals['altTabAppIconSize'] = this._altTab.APP_ICON_SIZE;
        }

        this._altTabSizesSet(size, null, null);
    }

    /**
     * enable screen sharing indicator
     *
     * @returns {void}
     */
    screenSharingIndicatorEnable()
    {
        if (this._shellVersion < 43) {
            return;
        }

        this.UIStyleClassRemove(this._getAPIClassname('no-screen-sharing-indicator'));
    }

    /**
     * disable screen sharing indicator
     *
     * @returns {void}
     */
    screenSharingIndicatorDisable()
    {
        if (this._shellVersion < 43) {
            return;
        }

        this.UIStyleClassAdd(this._getAPIClassname('no-screen-sharing-indicator'));
    }

    /**
     * enable screen recording indicator
     *
     * @returns {void}
     */
    screenRecordingIndicatorEnable()
    {
        if (this._shellVersion < 43) {
            return;
        }

        this.UIStyleClassRemove(this._getAPIClassname('no-screen-recording-indicator'));
    }

    /**
     * disable screen recording indicator
     *
     * @returns {void}
     */
    screenRecordingIndicatorDisable()
    {
        if (this._shellVersion < 43) {
            return;
        }

        this.UIStyleClassAdd(this._getAPIClassname('no-screen-recording-indicator'));
    }

    /**
     * set controls manager spacing to default
     *
     * @returns {void}
     */
    controlsManagerSpacingSetDefault()
    {
        if (this._controlsManagerSpacingSize === undefined) {
            return;
        }

        let classnameStarter = this._getAPIClassname('controls-manager-spacing-size');
        this.UIStyleClassRemove(classnameStarter + this._controlsManagerSpacingSize);

        delete this._controlsManagerSpacingSize;
    }

    /**
     * set controls manager spacing size
     *
     * @param {number} size in pixels (0 - 150)
     *
     * @returns {void}
     */
    controlsManagerSpacingSizeSet(size)
    {
        this.controlsManagerSpacingSetDefault();

        if (size < 0 || size > 150) {
            return;
        }

        this._controlsManagerSpacingSize = size;

        let classnameStarter = this._getAPIClassname('controls-manager-spacing-size');
        this.UIStyleClassAdd(classnameStarter + size);
    }

    /**
     * set workspaces view spacing to default
     *
     * @returns {void}
     */
    workspacesViewSpacingSetDefault()
    {
        let wsvp = this._workspacesView.WorkspacesView.prototype;

        if (wsvp._getSpacingOld === undefined) {
            return;
        }

        wsvp._getSpacing = wsvp._getSpacingOld;
        delete wsvp._getSpacingOld;
    }

    /**
     * set workspaces view spacing size
     *
     * @param {number} size in pixels (0 - 500)
     *
     * @returns {void}
     */
    workspacesViewSpacingSizeSet(size)
    {
        if (size < 0 || size > 500) {
            return;
        }

        let wsvp = this._workspacesView.WorkspacesView.prototype;

        if (wsvp._getSpacingOld === undefined) {
            wsvp._getSpacingOld = wsvp._getSpacing;
        }

        wsvp._getSpacing = function (box, fitMode, vertical) {
            if (fitMode === 0) {
                return size; 
            }
            return this._getSpacingOld(box, fitMode, vertical);
        };
    }
    
    /**
     * show dash app running dot
     *
     * @returns {void}
     */
    dashAppRunningDotShow()
    {
        this.UIStyleClassRemove(this._getAPIClassname('no-dash-app-running-dot'));
    }

    /**
     * hide dash app running dot
     *
     * @returns {void}
     */
    dashAppRunningDotHide()
    {
        this.UIStyleClassAdd(this._getAPIClassname('no-dash-app-running-dot'));
    }
}

