@echo off
chcp 65001 > nul
title 아케이드엑스 오산동탄점 3D 메타버스 서버
cd /d "%~dp0"
echo 🎢 [아케이드엑스 오산동탄점 3D 멀티플레이 웹서버]를 시작합니다...
start "" "http://localhost:3010/?room=server-1&instance=0&region=kr"
node server.js
pause
