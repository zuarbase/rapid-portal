import '../../node_modules/apitoolbox-ui/user-edit-modal.js';

(function() {

    const APP_VERSION_STRING = "v1 2020.10.01";

    var user,
        viz,
        views = [],
        vizWrapperEl = document.querySelector('#viz-wrapper'),
        viewsListEl = document.querySelector('#viewsList'),
        loaderEl = document.querySelector('#loader'),
        noViewsEl = document.querySelector('#no-views'),
        vizSelector = '#vizContainer',
        $changePasswordModal;

    window.vm = {
        fullname: '',
        refresh,
        revert,
        redo,
        undo,
        pause,
        resume,
        downloadPdf,
        downloadWorkbook,
        downloadImage,
        downloadData,
        downloadCrossTab,

        onUserClick,
        // onUpdatePasswordInputChange,
        onSavePasswordClick,
        onLogoutClick
    };

    // Init
    setAppVersion();
    zwaf.getViews().then(res => {
        views = res;
        loadThumbnails(views);
        loadInitialView();
        loadUser();
    });

    // Listen for browser Back/Forward events
    window.addEventListener('popstate', e => {
        loadInitialView();
    });

    // Resize viz on window resize
    window.addEventListener('resize', debounce(() => {
        if (viz) {
            setVizSize(viz, document.querySelector(vizSelector));
        }
    }, 300));

    function loadInitialView () {
        let href = window.location.pathname;
        let hasViewIdInUrl = href.indexOf('/p/') !== -1;
        if (views.length === 0) {
            showNoViewsMessage();
        } else if (hasViewIdInUrl) {
            let viewIndex = href.indexOf('/p/') + 2;
            let viewUrl = href.substring(viewIndex);
            for (i = 0; i < views.length; i++) {
                if (views[i].url === viewUrl) {
                    loadView(views[i], true);
                    break;
                }
            }
        } else {
            loadView(views[0], true);
        }
    }

    function loadUser () {
        zwaf.getAbout().then(about => {
            user = about.payload;
            let isAdmin = user.admin === "true" || user.admin === true;
            let nameEls = document.querySelectorAll('[data-user-name]');
            nameEls.forEach(el => {
                el.innerText = user.username;
            });

            if (!isAdmin) {
                let adminOnlyEls = document.querySelectorAll('[data-admin-only]');
                adminOnlyEls.forEach(el => {
                    el.style.display = 'none';
                });
            } else {
                let nonAdminOnlyEls = document.querySelectorAll('[data-non-admin-only]');
                nonAdminOnlyEls.forEach(el => {
                    el.style.display = 'none';
                });
            }
        });
    }

    function loadView (view, addParamsToQueryString) {
        setLoaderVisible(true);
        console.log(`Loading view: ${view.name}`, view);
        let containerDiv = document.querySelector(vizSelector),
            groupedFilters = zwaf.getQueryStringParamsAsObject();

        /**
         * https://help.tableau.com/current/api/js_api/en-us/JavaScriptAPI/js_api_concepts_filtering.html
         *  According to doc, filters can be set as options before initialization
         */
        let options = {
            hideTabs: true,
            hideToolbar: true,
            onFirstInteractive: function () {
                setVizSize(viz, containerDiv);
                showVizButtons();
                setShare(view);
                setLoaderVisible(false);
            },
            ...groupedFilters
        };

        if (viz) {
            viz.dispose();
        }

        let url = location.protocol + '//' + location.host + view.url;
        viz = new tableau.Viz(containerDiv, url, options);
        
        zwaf.setViz(viz);

        // Update URL in address bar
        let path = `/p${view.url}`;
        if (addParamsToQueryString) {
            path = path + location.search;
        }
        history.pushState({state: view.name}, view.name, path);

        // Scroll to viz
        window.scroll({
            top: 0,
            left: 0,
            behavior: 'smooth'
        });

        // Set active thumbnail style
        document.querySelectorAll('.thumbnail').forEach(thumbnailEl => {
            thumbnailEl.classList.remove('active');
        });
        let thumbnailId = 'id' + view.url.replace(/\//ig, '-');
        document.querySelector(`#${thumbnailId}.thumbnail`).classList.add('active');
    };
 
    function loadThumbnails (views) {
        if ('content' in document.createElement('template')) {
            viewsListEl.innerHTML = '';
            views.forEach(view => {
                let viewThumbnailTemplate = document.querySelector('#viewThumbnail');
                var thumbnailDocumentFragment = document.importNode(viewThumbnailTemplate.content, true);
                
                let thumbnailId = 'id' + view.url.replace(/\//ig, '-');
                thumbnailDocumentFragment.querySelector('.thumbnail').id = thumbnailId;
                thumbnailDocumentFragment.querySelector('.clickTarget').addEventListener('click', function () {
                    loadView(view);
                });
                thumbnailDocumentFragment.querySelector('.image').src = view.previewImage;
                thumbnailDocumentFragment.querySelector('.name').innerText = view.name;

                if (view.isFavorite) {
                    thumbnailDocumentFragment.querySelector('.star').classList.add('active');
                }

                thumbnailDocumentFragment.querySelector('.star').addEventListener('click', function (e) {
                    e.stopImmediatePropagation();
                    let starEl = e.target;
                    if (starEl.classList.contains('active')) {
                        e.target.classList.remove('active');
                        zwaf.deleteViewFromFavorites(view.id);
                    } else {
                        e.target.classList.add('active');
                        zwaf.addViewToFavorites(view.id);
                    }
                });

                viewsListEl.appendChild(thumbnailDocumentFragment);
            });
        } else {
            alert('HTML Templating is not supported.');
        }
    }

    function showNoViewsMessage () {
        noViewsEl.classList.remove('hidden');
    }

    function setLoaderVisible (visible) {
        if (visible) {
            vizWrapperEl.classList.add('hidden');
            loaderEl.classList.remove('hidden');

            let vizEl = document.querySelector(vizSelector);
            console.debug('vizEl', vizEl);
            vizEl.style.width = null;
            vizEl.style.height = null;
        } else {
            loaderEl.classList.add('hidden');
            vizWrapperEl.classList.remove('hidden');
        }
    }

    function setVizSize (viz, containerEl) {
        let parentWidth = containerEl.parentElement.offsetWidth;
        let parentHeight = containerEl.parentElement.offsetHeight;
        let newWidth = parentWidth;
        let newHeight = parentHeight;

        let sheet = viz.getWorkbook().getActiveSheet();
        let size = sheet.getSize();

        console.debug('Sizing dashboard "' + sheet.getName() + '" as ' + size.behavior);
        let text;

        switch (size.behavior) {
            case tableau.SheetSizeBehavior.AUTOMATIC:
                // Leave width as is
                // Set height as 4:3 aspect ratio of width
                newHeight = parentWidth * 3 / 4;
                break;
            case tableau.SheetSizeBehavior.EXACTLY:
                // Set to exact size.
                newWidth = size.minSize.width;
                newHeight = size.minSize.height;
                break;
            case tableau.SheetSizeBehavior.ATMOST:
                text += ' ' + size.maxSize.width + 'x' + size.maxSize.height;
                if (parentWidth > size.maxSize.width) {
                    // Set to maxSize.width and height
                    newWidth = size.maxSize.width;
                    newHeight = size.maxSize.height;
                } else {
                    // Leave width as is
                    // Set height to match aspect ratio
                    newHeight = parentWidth / size.maxSize.width * size.maxSize.height;
                }
                break;
            case tableau.SheetSizeBehavior.RANGE:
                // Make sure size is within range.
                // Otherwise do same as ATLEAST or ATMOST
                text += ' ' + size.minSize.width + 'x' + size.minSize.height + ' - ' + size.maxSize.width + 'x' + size.maxSize.height;
                if (parentWidth < size.minSize.width) {
                    newWidth = size.minSize.width;
                } else if (parentWidth > size.maxSize.width) {
                    newWidth = size.maxSize.width;
                }
                if (parentHeight < size.minSize.height) {
                    newHeight = size.minSize.height;
                } else if (parentHeight > size.maxSize.height) {
                    newHeight = size.maxSize.height;
                }
                break;
            case tableau.SheetSizeBehavior.ATLEAST:
                text += ' ' + size.minSize.width + 'x' + size.minSize.height;
                if (parentWidth < size.minSize.width) {
                    // Set width and height to minSize.width and height
                    newWidth = size.minSize.width;
                    newHeight = size.minSize.height;
                } else {
                    // Leave width as is
                    // set height to match aspect ratio
                    newHeight = parentWidth * size.minSize.height / size.minSize.width;
                }
                break;
        }

        console.debug(`Sizing to ${newWidth}px wide by ${newHeight}px high`);

        containerEl.style.width = newWidth + 'px';
        containerEl.style.height = newHeight + 'px';
        viz.setFrameSize(newWidth, newHeight);
    }

    function showVizButtons () {
        document.querySelectorAll('.vizbutton').forEach(buttonEl => {
            if (buttonEl.dataset['domFor'] !== 'resume') {
                buttonEl.classList.remove('hidden');
            }
        });
    }

    function setShare (view) {
        let shareEl = document.querySelector('[data-dom-for="share"]');
        shareEl.innerText = view.share;
        shareEl.href = view.share;
    }

    function refresh () {
        return viz.refreshDataAsync().then(function () {
            console.log('viz data refresh');
        });
    }

    function revert () {
        return viz.revertAllAsync().then(function () {
            console.log('viz revert');
        });
    }

    function redo () {
        return viz.redoAsync().then(function () {
            console.log('viz redo');
        });
    }

    function undo () {
        return viz.undoAsync().then(function () {
            console.log('viz undo');
        });
    }

    function pause () {
        return viz.pauseAutomaticUpdatesAsync().then(function () {
            console.log('viz paused');
            document.querySelector('[data-dom-for="resume"]').classList.remove('hidden');
            document.querySelector('[data-dom-for="pause"]').classList.add('hidden');
        });
    }

    function resume () {
        return viz.resumeAutomaticUpdatesAsync().then(function () {
            console.log('viz resumed');
            document.querySelector('[data-dom-for="pause"]').classList.remove('hidden');
            document.querySelector('[data-dom-for="resume"]').classList.add('hidden');
        });
    }

    function downloadPdf () {
        viz.showExportPDFDialog();
    }

    function downloadWorkbook () {
        viz.showDownloadWorkbookDialog();
    }

    function downloadImage () {
        viz.showExportImageDialog();
    }

    function downloadData () {
        viz.showExportDataDialog();
    }

    function downloadCrossTab () {
        viz.showExportCrossTabDialog();
    }

     function onUserClick () {
        let userEditModalEl = document.querySelector('user-edit-modal');
        userEditModalEl.setAttribute('open-modal', false);
        userEditModalEl.setAttribute('user-id', user.id);
        console.debug('Editing' , user);
        window.showUserEdit = false;
        setTimeout(() => {
            userEditModalEl.setAttribute('open-modal', true);
        });
    }

    // function onChangePasswordClick () {
    //     document.querySelector('.update-password-error').classList.add('hidden');
    //     $changePasswordModal = $('#updatePasswordModal').modal({});
    //     onUpdatePasswordInputChange();
    // }

    // function onUpdatePasswordInputChange () {
    //     document.querySelector('.update-password-error').classList.add('hidden');
    //     let submitButton = document.querySelector('#updatePasswordSaveButton');
    //     let val1 = document.querySelector('#updatePassword1').value;
    //     let val2 = document.querySelector('#updatePassword2').value;
    //     submitButton.disabled = !val1.length || !val2.length || val1 !== val2;
    // }

    function onSavePasswordClick () {
        let newPassword = document.querySelector('#updatePassword1').value;
        zwaf.updatePassword(newPassword)
            .then(() => {
                $changePasswordModal.modal('hide');
            })
            .catch(e => {
                let errorEl = document.querySelector('.update-password-error')
                errorEl.innerText = e;
                errorEl.classList.remove('hidden');
            });
        
    }

    function onLogoutClick () {
        zwaf.logout();
    }

    function setAppVersion () {
        let metaEl = document.createElement('meta');
        metaEl.setAttribute('zuar-rapid-portal-version', APP_VERSION_STRING);
        document.querySelector('head').prepend(metaEl);
        console.log('Zuar Rapid Portal ' + APP_VERSION_STRING);
    }

    function debounce (callback, wait) {
        let timeout = null
        return (...args) => {
            const next = () => callback(...args)
            clearTimeout(timeout)
            timeout = setTimeout(next, wait)
        }
    }

})();
