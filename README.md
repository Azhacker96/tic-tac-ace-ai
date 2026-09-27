# TicTacToe Pal

Build a complete, polished, mobile-first Tic-Tac-Toe multiplayer game application that is designed from the beginning to be packaged as an Android app and eventually published on Google Play Store.



Do not create a simple demo or static prototype. Build the actual functional application with proper state management, authentication, database structure, game logic, error handling, and responsive mobile UI.



1. AUTHENTICATION



On first launch, show a clean Login/Welcome screen with:



- Game logo

- Short welcome text

- "Continue with Google"

- "Continue as Guest"



Do NOT create email/password registration.



Continue with Google



Implement Google authentication using a proper authentication provider/backend.



After successful Google login:



- Check whether the user already has a profile.

- If profile exists, open Home.

- If new user, ask for a nickname only once.

- Generate a unique Player ID automatically.

- Save the profile.



Continue as Guest



- Ask for nickname.

- Generate a unique Player ID automatically.

- Save guest profile locally.

- Allow the user to play offline/same-device games.

- Clearly indicate which online/account features require Google login.



Guest Account Upgrade



A Guest user must be able to connect/link their existing guest profile to Google later.



Do NOT create a new profile when linking Google.



Preserve:



- Nickname

- Player ID

- Game statistics

- Friends where technically possible

- Game history where technically possible



The user should not be forced to enter their nickname every time they open the app.



2. HOME SCREEN



Create a modern game dashboard containing:



- Player avatar

- Nickname

- Player ID

- Play with Computer

- 2 Players

- Online Multiplayer

- Friends

- Profile

- Settings



Show the user's basic win/loss/draw statistics where appropriate.



3. PLAY WITH COMPUTER



Create a fully functional Tic-Tac-Toe game against the computer.



Difficulty levels:



- Easy

- Medium

- Hard

- Expert



The AI must actually behave differently at each difficulty.



Include:



- Select X or O

- Turn indicator

- Highlight winning combination

- Win/loss/draw detection

- Restart game

- Rematch

- Return to Home



Do not use fake AI buttons or placeholder functionality.



4. TWO PLAYERS — SAME DEVICE



Create a fully functional local two-player mode.



Features:



- Player 1 vs Player 2

- Select X/O

- Turn indicator

- Board interaction

- Win detection

- Draw detection

- Winning-line animation/highlight

- Rematch

- New Game

- Return Home



Both players must be able to play on the same device.



5. ONLINE MULTIPLAYER



Implement real online multiplayer architecture.



Match options:



Create Match



- Generate a unique short match code.

- Show the code.

- Allow the host to share/copy the code.

- Wait for opponent.



Join Match



- Enter match code.

- Validate the code.

- Join the correct match.

- Start the game when both players are connected.



Game state must synchronize between players in real time.



Synchronize:



- Board

- Current turn

- Player identities

- Game status

- Timer

- Winner

- Draw

- Rematch state



Do not implement online multiplayer as a fake/local simulation.



6. ONLINE TURN TIMER + AUTOPILOT



Add a turn timer similar to competitive board games.



When a player's turn starts:



- Start countdown.

- Clearly display remaining time.



When timer expires:



- Automatically activate "Autopilot".

- Autopilot makes a valid move for that player.

- Opponent should NOT automatically win merely because the timer expires.



When the original player returns:



- Allow them to turn Autopilot off if the game state still permits it.

- Clearly indicate when Autopilot is active.



Handle:



- Temporary disconnection

- Reconnection

- App going into background

- Network loss

- Opponent leaving

- Match expiration



If a player completely abandons the match, implement a reasonable timeout/forfeit mechanism.



7. FRIEND SYSTEM



Create a functional friends system for authenticated users.



Features:



- Search user by Player ID

- Send friend request

- Accept request

- Reject request

- Remove friend

- Block user

- Unblock user

- View friends list

- Online/offline status

- Appear Offline setting

- Invite an online friend to play



Blocked users must not be able to send unwanted friend/game requests.



8. PROFILE



Create a Profile screen containing:



- Avatar

- Nickname

- Unique Player ID

- Account type: Guest / Google

- Games Played

- Wins

- Losses

- Draws

- Win percentage



Allow:



- Change nickname

- Change avatar

- Link Guest account to Google



Player ID should remain unique and should not randomly change.



9. SETTINGS



Create:



Audio



- Music ON/OFF

- Sound Effects ON/OFF



Appearance



- Board/theme selection

- Light/Dark mode if appropriate



Account



- Profile

- Change nickname

- Link Google account

- Logout



Privacy/Social



- Appear Online

- Appear Offline

- Blocked Users



Persist all settings.



10. GAME THEMES / BOARD SKINS



Create several visually polished board themes/skins.



At minimum:



- Classic

- Neon

- Dark

- Minimal



The selected theme must persist after closing/reopening the app.



Structure the theme system so additional skins can easily be added later.



11. GAME RESULT SCREEN



After every completed game show:



- Winner / Draw

- Winning player

- Winning combination

- Updated statistics

- Rematch

- New Game

- Home



For online games also show:



- Opponent nickname

- Opponent Player ID

- Add Friend option

- Rematch option



12. DATA / BACKEND



Use a proper backend/database architecture for online functionality.



Create appropriate database structures for:



- Users

- Profiles

- Guest profiles/local data

- Friend requests

- Friends

- Blocked users

- Games

- Online matches

- Match players

- Game moves/state

- Statistics

- User settings



Do not expose sensitive credentials or service keys in frontend code.



Use secure authentication and database access rules.



Do not fabricate backend functionality.



If a backend service needs to be configured manually, clearly identify the required configuration rather than pretending it is complete.



13. OFFLINE SUPPORT



The following should work without an internet connection:



- App launch

- Guest profile

- Play with Computer

- Two Players on Same Device

- Local settings

- Local statistics



Online features should clearly show an appropriate connection/login requirement.



14. MOBILE-FIRST UI



Design specifically for phones.



Requirements:



- Responsive layout

- Touch-friendly buttons

- Large playable Tic-Tac-Toe board

- Safe-area support

- No horizontal scrolling

- No overlapping elements

- Proper keyboard handling for match-code/nickname fields

- Smooth screen transitions

- Loading states

- Empty states

- Error states

- Confirmation dialogs where necessary



Make the UI look like a real commercial mobile game, not a generic dashboard.



15. NAVIGATION



Use a clean navigation structure:



Welcome/Login

→ Profile Setup

→ Home



Home

→ Computer

→ Two Players

→ Online Multiplayer

→ Friends

→ Profile

→ Settings



Make back navigation behave correctly on Android.



16. VALIDATION AND SECURITY



Implement proper validation for:



- Nickname

- Player ID

- Match code

- Friend requests

- Authentication

- Game moves



Never trust client-side game results for online matches.



Prevent:



- Invalid moves

- Moving out of turn

- Duplicate moves

- Playing after game completion

- Joining invalid/expired matches

- Unauthorized access to another user's private data



17. ERROR HANDLING



Do not leave blank screens or broken buttons.



Provide useful messages for:



- No internet

- Google login failure

- Match not found

- Match expired

- Opponent disconnected

- Server error

- Invalid code

- User not found



Include loading indicators whenever an operation takes time.



18. CODE QUALITY



Use a clean, modular architecture.



Separate:



- UI

- Game logic

- Authentication

- Database/backend

- Online matchmaking

- Friend system

- Settings

- Theme system



Avoid unnecessary duplicated code.



Keep the project maintainable and suitable for future Android packaging.



19. IMPORTANT IMPLEMENTATION RULE



Do not mark a feature as complete simply because its UI exists.



Every button and major feature must have working functionality.



If something cannot be implemented because a required external service/API/configuration is missing, clearly identify it and provide the exact configuration needed.



Do not use fake data for features that are supposed to be real.



20. FINAL TESTING



After implementation, perform a complete application audit.



Test:



- First launch

- Guest login

- Google login

- Existing user login

- Guest → Google account linking

- Profile creation

- Nickname change

- Computer mode at all difficulties

- Same-device multiplayer

- Online create match

- Online join match

- Real-time moves

- Turn timer

- Autopilot

- Rematch

- Disconnect/reconnect

- Friends

- Friend requests

- Block/unblock

- Appear Offline

- Statistics

- Settings persistence

- Theme persistence

- Logout

- Android back navigation

- Small and large phone screens



Fix all discovered functional, UI, navigation, state-management, and responsiveness issues.



Finally, provide a concise report containing:



1. Features implemented

2. Features requiring external configuration

3. Backend/authentication configuration required

4. Any known limitations

5. Steps required to package the project as Android APK/AAB

6. Anything still required before Google Play Store submission



Build the application completely rather than stopping after creating the screens.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tic-tac-ace-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ca20580b-4a2a-4a41-b8b9-dc5784304cfe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
