![banner](https://github.com/user-attachments/assets/2f3ff9d7-d552-4ee8-a3fd-ad67c6415936)
# Official Repository for SDesk

You can get a prebuilt ISO at: _https://stevestudios.net/downloads_

## Building

### Prequisites
- Arch Linux, SDesk, or another Arch-Derived Distribution
- The [archiso](https://archlinux.org/packages/extra/any/archiso/) package
- OPTIONAL (But recommended): The [qemu-full](https://archlinux.org/packages/extra/x86_64/qemu-full/) package for testing the disk image
  
### Compiling the Disk Image for the first time

Run the following command to build the SDesk disk image:

```
sudo ./build.sh
```

### Recompiling the Disk Image

Run the following commands to rebuild the SDesk disk image:

```
sudo rm -rf ./work
sudo rm -rf ./out
sudo ./build.sh
```

## Testing

### UEFI
Run the following command to test the SDesk disk image with QEMU emulating UEFI and using GRUB:
 
```
run_archiso -u -i "ISO NAME GOES HERE"
```

### BIOS
Run the following command to test the SDesk disk image with QEMU emulating BIOS and using SysLinux:
 
```
run_archiso -i "ISO NAME GOES HERE"
```

[Archiso man page](https://wiki.archlinux.org/title/archiso)
