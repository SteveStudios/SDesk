#!bin/bash

if (( $EUID == 0 )) && [ -d "/usr/share/calamares/" ]; then
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

	systemctl set-default graphical.target
	
	yes | pacman -R epiphany
	
	sudo rm -rf /usr/bin/neofetch
	sudo mv /usr/bin/tmpneofetch /usr/bin/neofetch
	
	sudo chmod a+x /usr/bin/setup.sh
	sudo chmod a+x /usr/bin/neofetch.sh
	
	systemctl start NetworkManager.service
	systemctl enable NetworkManager.service
		
	systemctl start gdm
	systemctl enable gdm
fi

if ! calamares && [ ! -d "/usr/share/calamares/" ]; then
	sudo /usr/bin/post-install
fi
	
	

