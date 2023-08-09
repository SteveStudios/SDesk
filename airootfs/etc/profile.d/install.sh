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
	
	sudo rm -rf /usr/lib/os-release
	sudo mv /usr/lib/tmpos-release /usr/lib/os-release

	sudo rm -rf /etc/os-release
	sudo mv /etc/tmpos-release /etc/os-release
	
	sudo pacman-key --init
	sudo pacman-key --populate
	
	yes | pacman -R epiphany | grep "hide_the-output"
	
	sudo rm -rf /usr/bin/neofetch
	sudo mv /usr/bin/tmpneofetch /usr/bin/neofetch
	
	sudo chmod a+x /usr/bin/neofetch
	sudo chmod a+x /usr/bin/launch_calamares

	systemctl start NetworkManager.service | grep "hide_the-output"
	systemctl enable NetworkManager.service | grep "hide_the-output"
		
	systemctl start gdm | grep "hide_the-output"
	systemctl enable gdm | grep "hide_the-output"
fi