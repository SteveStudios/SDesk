#!/bin/bash

if [ ! -d "/home/repository" ]; then
    cp -r ./repository /home/
fi

mkarchiso -v -w ./work -o ./out ./
