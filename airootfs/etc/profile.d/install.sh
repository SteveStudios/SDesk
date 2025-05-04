#!bin/bash

if (( $EUID == 0 )); then
	rfkill unblock all
	
	sudo rm -rf /usr/share/calamares/branding
		
	sudo mv /usr/share/tmpbranding /usr/share/calamares/
	sudo mv /usr/share/calamares/tmpbranding /usr/share/calamares/branding
	
	sudo rm -rf /usr/share/calamares/modules
		
	sudo mv /usr/share/tmpmodules /usr/share/calamares/
	sudo mv /usr/share/calamares/tmpmodules /usr/share/calamares/modules
	
	sudo rm -rf /etc/xdg/autostart/calamares.desktop
	sudo mv /etc/xdg/autostart/tmpcalamares.desktop /etc/xdg/autostart/calamares.desktop
	
	sudo rm -rf /usr/share/applications/calamares.desktop
	sudo mv /usr/share/tmpcalamares.desktop /usr/share/applications/calamares.desktop
	
	sudo rm -rf /usr/share/calamares/settings.conf
	sudo mv /usr/share/tmpsettings.conf /usr/share/calamares/settings.conf
	
	sudo pacman-key --init | grep "hide_the-output"
	sudo pacman-key --populate | grep "hide_the-output"
	
	yes | pacman -R epiphany | grep "hide_the-output"
	yes | pacman -R gnome-console | grep "hide_the-output"
	yes | pacman -R gnome-software | grep "hide_the-output"
	yes | pacman -Rdd qt6-wayland | grep "hide_the-output"

	sudo chmod a+x /usr/bin/launch_calamares

	dconf reset -f /org/gnome/

	sudo chmod -R 777 /usr/share/gnome-shell/extensions
	sudo chmod 777 /usr/bin/setup-final.sh
	
	gsettings set org.gnome.shell welcome-dialog-last-shown-version '4294967295'
	dconf write /org/gnome/shell/extensions/dash-to-dock/disable-overview-on-startup true
	sudo dconf update

	systemctl start firewalld.service | grep "hide_the-output"
	systemctl enable firewalld.service | grep "hide_the-output"

	systemctl start NetworkManager.service | grep "hide_the-output"
	systemctl enable NetworkManager.service | grep "hide_the-output"

	systemctl start gdm | grep "hide_the-output"
	systemctl enable gdm | grep "hide_the-output"
fi
