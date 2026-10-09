# Готовая настольная игра

[Скачать IRONFRONT-Godot-Windows.zip](https://github.com/nicoomartinezpsplus-coder/hoi4/raw/refs/heads/main/downloads/IRONFRONT-Godot-Windows.zip) — Windows 10/11 x64, примерно 40 МБ.

Распакуйте архив и запустите **IRONFRONT.exe** двойным щелчком. Node.js, npm, браузер и редактор Godot не требуются. **Пробел** — пауза, **1–5** — скорость. Подробности — в `START-HERE.txt` внутри ZIP и [инструкции Godot](../godot/README.md).

Контрольная сумма ZIP находится в `SHA256SUMS.txt`. Сборка экспортирована Godot 4.6.3 из этого репозитория; исходники — `godot/`. Игра и производная карта доступны под GPL-3.0; лицензии движка и шрифтов включены в ZIP.

Проверены 33 проверки нативной симуляции, настоящий интерфейс Godot и запуск экспортированной Linux-версии отдельно от исходников. Windows-экспорт собран и проверен как архив с исполняемым PE x64 и встроенными данными; запуск непосредственно на Windows в этой Linux-среде не выполнялся.

Будущие сборки Windows/Linux также создаёт workflow `Godot desktop builds`; после успешного запуска они доступны в его артефакте `IRONFRONT-Godot-desktop`.
