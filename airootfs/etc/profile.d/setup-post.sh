#!/bin/bash

if (( EUID != 0 )) && [ ! -f "/etc/profile.d/install.sh" ] && [ ! -f "/etc/profile.d/setup.sh" ] && [ ! -f "/usr/bin/setup-final.sh" ]; then
	sudo rm -rf /etc/profile.d/setup-post.sh
	sudo userdel -f live

	sudo mv /etc/gdm/lastcustom.conf /etc/gdm/custom.conf
	sudo mv /etc/tmpsudoers /etc/sudoers

	gsettings set org.gnome.shell welcome-dialog-last-shown-version '4294967295'
	sudo dconf update
	
	gsettings set org.gnome.desktop.wm.preferences button-layout ":minimize,maximize,close"
	
	gnome-extensions enable user-theme@gnome-shell-extensions.gcampax.github.com
	gnome-extensions enable add-to-desktop@tommimon.github.com
	gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com
	gnome-extensions enable dash-to-dock@micxgx.gmail.com
	gnome-extensions enable gtk4-ding@smedius.gitlab.com
	gnome-extensions enable just-perfection-desktop@just-perfection
	gnome-extensions enable light-style@gnome-shell-extensions.gcampax.github.com
	gnome-extensions enable tiling-assistant@leleat-on-github
	gnome-extensions enable arch-update@RaphaelRochet

	dconf write /org/gnome/shell/extensions/arch-update/notify true
	dconf write /org/gnome/shell/extensions/dash-to-dock/extend-height true
	dconf write /org/gnome/shell/extensions/dash-to-dock/show-apps-at-top true
	dconf write /org/gnome/shell/extensions/dash-to-dock/custom-theme-shrink true
	dconf write /org/gnome/shell/extensions/dash-to-dock/dock-fixed true
	dconf write /org/gnome/shell/extensions/dash-to-dock/running-indicator-style "'SQUARES'"
	dconf write /org/gnome/shell/extensions/dash-to-dock/always-center-icons true
	dconf write /org/gnome/shell/extensions/dash-to-dock/disable-overview-on-startup true
	dconf write /org/gnome/shell/extensions/dash-to-dock/dock-fixed false
    dconf write /org/gnome/shell/extensions/dash-to-dock/transparency-mode "'FIXED'"
	dconf write /org/gnome/shell/extensions/dash-to-dock/background-opacity 0.6
    dconf write /org/gnome/shell/extensions/dash-to-dock/autohide true
    dconf write /org/gnome/shell/extensions/dash-to-dock/intellihide true

	dconf write /org/gnome/shell/extensions/just-perfection/workspace-switcher-should-show true
	dconf write /org/gnome/shell/extensions/just-perfection/workspace-switcher-size 10
	dconf write /org/gnome/shell/extensions/just-perfection/startup-status 0
	
	gsettings set org.gnome.desktop.interface icon-theme 'kora'
	gsettings set org.gnome.desktop.interface cursor-theme 'SShell'

	gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
	gsettings set org.gnome.desktop.background picture-uri-dark file:////usr/share/pixmaps/sd-bg-default.png
	
 	gsettings set org.gnome.shell favorite-apps "['calamares.desktop', 'swirl.desktop', 'org.gnome.Geary.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'octopi.desktop']"

	xdg-settings set default-web-browser swirl.desktop
fi
