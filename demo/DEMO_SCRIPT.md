# Demo Recording Script

Use this script to record a GIF for the README. 
Recommended tool: [Kap](https://getkap.co/) (free, Mac) or [LICEcap](https://www.cockos.com/licecap/) (Windows).

## Settings
- Resolution: 1200x800 or 1400x900
- FPS: 15-20 (keeps file size small)
- Format: GIF

## Recording Steps

### demo-preview.gif (Main demo, ~15 seconds)
1. Open `demo/sample.md` in VS Code
2. Press `Cmd+Shift+V` to open preview
3. Scroll down slowly through the content (show TOC following along)
4. Click a heading in the TOC sidebar (show smooth scroll)
5. Click "Editorial" theme button
6. Pause 2 seconds
7. Click "Terminal" theme button
8. Pause 2 seconds
9. Click the dark/light toggle switch
10. Stop recording

### demo-search.gif (Search feature, ~8 seconds)
1. With preview open, press `Cmd+K`
2. Type "context" slowly
3. Press `Enter` twice to cycle through matches
4. Press `Esc` to close
5. Stop recording

### demo-toc.gif (TOC collapse, ~6 seconds)
1. With preview open, click the collapse button on the sidebar
2. Pause - show the mini dots
3. Click a dot to navigate
4. Click the expand button
5. Stop recording

## After Recording

Place GIFs in the `demo/` folder:
- `demo/demo-preview.gif`
- `demo/demo-search.gif`
- `demo/demo-toc.gif`

Then update README.md to reference them:
```markdown
![Preview Demo](demo/demo-preview.gif)
```
