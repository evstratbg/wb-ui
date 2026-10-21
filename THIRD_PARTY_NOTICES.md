# Third-party notices

## Wiren Board homeui

This project is derived from [wirenboard/homeui](https://github.com/wirenboard/homeui), tag `v2.208.1-wb100`, commit `0546d10e7ade2894baa5a828549900b708ca52a8`. The upstream MIT copyright notices are retained in [LICENSE](LICENSE). The initial import uses a source snapshot, rather than importing the upstream Git history.

Unused upstream `frontend/app/styles/img/demo_/` and `frontend/app/styles/img/avatars/` images are omitted: their notices restrict redistribution. They are not referenced by the application or emitted by the production build. This publication does not include installation-specific configuration or raw controller screenshots.

## Bundled assets and vendor code

The root MIT license applies to project code; it does not replace separate license terms or grant trademark rights. Existing source headers and notices remain in place.

| Component | Existing attribution / terms | Where retained |
| --- | --- | --- |
| Roboto | Copyright 2011 The Roboto Project Authors; SIL Open Font License 1.1 | [Roboto-OFL.txt](licenses/Roboto-OFL.txt), `frontend/src/assets/fonts/roboto/OFL.txt` |
| Font Awesome 4.2 | Dave Gandy / Font Awesome; font SIL OFL 1.1, CSS MIT | [Font-Awesome-4-NOTICE.txt](licenses/Font-Awesome-4-NOTICE.txt), `frontend/app/styles/css/font-awesome.min.css` |
| Font Awesome Free 5.15.4 | Font Awesome / Fonticons, Inc.; icons CC BY 4.0, fonts SIL OFL 1.1, code MIT | [Font-Awesome-Free-LICENSE.txt](licenses/Font-Awesome-Free-LICENSE.txt), CSS/font source headers |
| Subtle Patterns | Subtle Patterns; CC BY-SA 3.0 Unported | [Subtle-Patterns-NOTICE.txt](licenses/Subtle-Patterns-NOTICE.txt), `frontend/app/styles/img/pattern/license-info.txt`; [license](https://creativecommons.org/licenses/by-sa/3.0/) |
| Angular UI Bootstrap 2.1.4 | angular-ui / AngularUI Team; MIT | Header in `frontend/app/3rdparty/ui-bootstrap.js` |
| Bootstrap / normalize.css | Existing upstream headers identify Bootstrap and normalize.css with their license notices | `frontend/app/styles/css/bootstrap.min.css` |
| SmartAdmin-derived styles | Retained from the cited homeui snapshot; existing SmartAdmin headers are preserved | `frontend/app/styles/css/smartadmin-production.min.css` and related styles |
| Legacy invoice images | Existing notice attributes source to iconfinder.com; it does not provide a separate license grant | `frontend/app/styles/img/invoice/license.txt` |

The original Font Awesome 5 license notice is retained verbatim. Full generic terms are also included as [SIL OFL 1.1](licenses/SIL-Open-Font-License-1.1.txt) and [MIT](licenses/MIT-terms.txt); copyright attributions remain in the component notices. Font Awesome 4 attribution and its original license URL are retained separately. Pattern assets are unmodified.

Other npm dependencies retain their own licenses in their published packages. Production builds also emit `*.js.LICENSE.txt` alongside JavaScript bundles; keep these files when copying or distributing the build. The deploy archive includes this notice, the project license and `licenses/`; Webpack copies the same notices into `dist/licenses/`.

The dependency lockfile is [frontend/package-lock.json](frontend/package-lock.json). This notice records available upstream attributions; it does not relicense vendor assets or assert additional permissions for them.
