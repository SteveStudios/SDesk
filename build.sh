#!/bin/bash

if [ ! -d "/home/repository" ]; then
    cp -r ./repository /home/
else
    rm -rf ./home/repository
    cp -r ./repository /home/
fi

if [ -d "./airootfs/etc/default" ]; then
    rm -rf ./airootfs/etc/default
fi

if [ -e "./airootfs/etc/mkinitcpio.conf" ]; then
    rm -f ./airootfs/etc/mkinitcpio.conf
fi

if [ -e "./packages.x86_64" ]; then
    rm -f ./packages.x86_64
fi

mkdir ./airootfs/etc/default
if [ "$1" = "--nvidia" ]; then
    cp ./nvidia/grub/grub_with_nvidia ./airootfs/etc/default/grub
    cp ./nvidia/mkinitcpio/mkinitcpio_with_nvidia.conf ./airootfs/etc/mkinitcpio.conf
    cp ./nvidia/packagelists/packages_with_nvidia.x86_64 ./packages.x86_64
else
    cp ./nvidia/grub/grub_no_nvidia ./airootfs/etc/default/grub
    cp ./nvidia/mkinitcpio/mkinitcpio_no_nvidia.conf ./airootfs/etc/mkinitcpio.conf
    cp ./nvidia/packagelists/packages_no_nvidia.x86_64 ./packages.x86_64
fi

mkarchiso -v -w ./work -o ./out ./

if [ -d "./airootfs/etc/default" ]; then
    rm -rf ./airootfs/etc/default
fi

if [ -e "./airootfs/etc/mkinitcpio.conf" ]; then
    rm -f ./airootfs/etc/mkinitcpio.conf
fi

if [ -e "./packages.x86_64" ]; then
    rm -f ./packages.x86_64
fi
