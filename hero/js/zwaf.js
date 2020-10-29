(function () {

    const PAGE_SIZE = 100,
          TABLEAU_API_VERSION = '3.3';
    let viz;


    var init = function () {
        this.initPromise = this.initPromise || get('/auth/about', {responseType: 'json'}).then(about => {
            this.about = about;
            this.BASE_URL = `/api/${this.about.tableau_server.rest_api_version}`;
            return this.about;
        });
        return initPromise;
    };

    const getViz = () => {
        if (!viz){
            throw new Error('No Dashboard found');
        }
        return viz;
    }

    const setViz = (vizObject) => {
        viz = vizObject;

        viz.addEventListener(tableau.TableauEventName.FILTER_CHANGE, function (event) {
            event.getFilterAsync().then(onFilterChange)
        });

        viz.addEventListener(tableau.TableauEventName.PARAMETER_VALUE_CHANGE, function (event) {
            event.getParameterAsync().then(onParamChange)
        });
    }

    const getAbout = () => {
        return init().then(about => {
            return about;
        });
    };

    const getWorkbooks = (pageNumber = 1, pageSize = PAGE_SIZE, workbooks = []) => {
        return init().then(() => {
            let url = `${this.BASE_URL}/sites/${this.about.tableau_server.site_id}/workbooks?sort=name:asc&pageSize=${pageSize}`;
            return get(url, {responseType: 'xml'}).then(function (res) {

                // TODO - parse as XML
                res.data.workbooks.workbook.forEach(workbook => {
                    workbooks.push(workbook);
                });

                let pagination = _getPagination(res);
                if (pagination.pageNumber * pagination.pageSize >= pagination.totalAvailable) {
                    return workbooks;
                } else {
                    return getWorkbooks(pageNumber + 1, pageSize, workbooks);
                }
            });
        });
    };

    const getViews = ({workbook, owner, project, tags = [], sort = 'name:asc'} = {}, pageNumber = 1, pageSize = PAGE_SIZE, views = []) => {
        return init().then(() => {
            return getFavorites().then((favorites) => {
                let url = `${this.BASE_URL}/sites/${this.about.tableau_server.site_id}/views?sort=${sort}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
                if (tags.length) {
                    url += `&filter=tags:in:[${tags.join(',')}]`;
                }
                return get(url, {responseType: 'xml'}).then(function (res) {
                    res.querySelectorAll('view').forEach(viewNode => {
                        let view = {};
                        view.id = viewNode.getAttribute('id');
                        view.name = viewNode.getAttribute('name');
                        view.workbook = viewNode.querySelector('workbook').getAttribute('id');
                        view.owner = viewNode.querySelector('owner') ? viewNode.querySelector('owner').getAttribute('id') : null;
                        view.project = viewNode.querySelector('project').getAttribute('id');
                        view.contentUrl = viewNode.getAttribute('contentUrl');
                        view.url = buildViewUrl(view.contentUrl);
                        view.iframe = `${view.url}?iframeSizedToWindow=true&:embed=y&:tabs=n&:toolbar=n`;
                        view.share = location.protocol + '//' + location.host + view.url + '?:embed=y';
                        view.previewImage = '/api/' + this.about.tableau_server.rest_api_version + '/sites/' + this.about.tableau_server.site_id + '/workbooks/' + viewNode.querySelector('workbook').getAttribute('id') + '/views/' + viewNode.getAttribute('id') + '/previewImage';
                        view.isFavorite = favorites.includes(view.id);

                        if (!_isFilteredOut(view, workbook, owner, project)) {
                            views.push(view);
                        }
                    });

                    let pagination = _getPagination(res);
                    if (pagination.pageNumber * pagination.pageSize >= pagination.totalAvailable) {
                        return views.sort(viewSort);
                    } else {
                        return getViews({workbook, owner, project, tags, sort}, pageNumber + 1, pageSize, views);
                    }
                })
                .catch(e => {
                    console.error('Error getting views', e);
                });
            });
        });
    };

    const getFavorites = () => {
        this.favoritesPromise = this.favoritesPromise || init().then(() => {
            let favorites = [];
            let url = `${this.BASE_URL}/sites/${this.about.tableau_server.site_id}/favorites/${this.about.payload.tableau_site_user_id}`;
            return get(url, {responseType: 'xml'}).then(function (res) {
                res.querySelectorAll('favorite').forEach(favoriteNode => {
                    favorites.push(favoriteNode.getAttribute('label'));    
                });
                return favorites;
            })
            .catch(e => {
                console.error('Error getting favorites', e);
                return [];
            });
        });
        return this.favoritesPromise;
    }

    const addViewToFavorites = (viewId) => {
        let url = `${this.BASE_URL}/sites/${this.about.tableau_server.site_id}/favorites/${this.about.payload.tableau_site_user_id}`;
        let payload = `<tsRequest><favorite label="${viewId}"><view id="${viewId}"/></favorite></tsRequest>`;
        return new Promise((resolve, reject) => {
            put(url, {contentType: 'application/xml', responseType: 'xml', payload})
                .then(response => {
                    resolve(response);
                })
                .catch(xmlResponseDoc => {
                    reject(xmlResponseDoc.querySelector('summary').textContent + ': ' + xmlResponseDoc.querySelector('detail').textContent);
                });
        });
    }

    const deleteViewFromFavorites = (viewId) => {
        let url = `${this.BASE_URL}/sites/${this.about.tableau_server.site_id}/favorites/${this.about.payload.tableau_site_user_id}/views/${viewId}`;
        return new Promise((resolve, reject) => {
            del(url, {contentType: 'application/xml', responseType: 'xml'})
                .then(response => {
                    resolve(response);
                })
                .catch(xmlResponseDoc => {
                    reject(xmlResponseDoc.querySelector('summary').textContent + ': ' + xmlResponseDoc.querySelector('detail').textContent);
                });
        });
    }

    const getProjects = () => {
        return init().then(() => {
            return get(url, {responseType: 'xml'}).then(function (res) {
                return $q.all([
                    this.getWorkbooks.call(this),
                    this.getViews.call(this),
                ]).then(function (result) {
                    let projects = {},
                        workbooks = {};
                    result[0].forEach(workbook => {
                        let project = projects[workbook.project.id] || {
                            id: workbook.project.id,
                            name: workbook.project.name,
                            workbooks: {},
                            views: {},
                        };

                        project.workbooks[workbook.id] = workbook;
                        workbook.project = project;

                        projects[project.id] = project;
                        workbooks[workbook.id] = workbook;
                        workbook.views = {};
                    });
                    result[1].forEach(view => {
                        let workbook = workbooks[view.workbook.id];
                        view.workbook = workbook;
                        workbook.views[view.id] = view;
                        workbook.project.views[view.id] = view;
                    });
                    return projects;
                });
            });
        });
    };

    const buildViewUrl = (contentUrl) => {
        let siteContentUrl = about.tableau_server.site_content_url;
        contentUrl = contentUrl.replace(/\/sheets\//, '/');

        let url = '/views/' + contentUrl;
        if (siteContentUrl !== '' && siteContentUrl !== 'default' && siteContentUrl !== null) {
            url = '/t/' + siteContentUrl + url;
        }
        return url;
    };

    function _isFilteredOut(view, workbook, owner, project) {
        if (typeof workbook === 'undefined' && typeof owner === 'undefined' && typeof project === 'undefined') {
            return false;
        } else if (typeof workbook != 'undefined' && workbook === view.workbook) {
            return false;
        } else if (typeof owner != 'undefined' && owner === view.owner) {
            return false;
        } else if (typeof project != 'undefined' && project === view.project) {
            return false;
        }
        return true;
    }

    function _getPagination (xmlResult) {
        let paginationEl = xmlResult.querySelector('pagination');
        return {
            pageNumber: paginationEl.getAttribute('pageNumber'),
            pageSize: paginationEl.getAttribute('pageSize'),
            totalAvailable: paginationEl.getAttribute('totalAvailable'),
        };
    } 

    const get = (url, options) => {
        return req(url, 'GET', options);
    };

    const put = (url, options) => {
        return req(url, 'PUT', options);
    }

    const del = (url, options) => {
        return req(url, 'DELETE', options);
    }

    const req = (url, method, options) => {
        let { responseType, payload, contentType } = options;
        if (responseType === 'xml') {
            responseType = 'document';
        }
        return new Promise( (resolve, reject) => {
            var req = new XMLHttpRequest();
            req.responseType = responseType || '';
            req.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status === 401) {
                        window.location = '/login';
                    }
                    if (this.status >= 400 && this.status < 600) {
                        reject(this.response);
                    }
                    resolve(this.response);
                }
            }
            req.open(method, url, true);
            if (contentType) {
                req.setRequestHeader('Content-Type', contentType);
            }
            req.send(payload);
        });
    }
    function _debounce (delay, fn) {
        let timerId;
        return function(...args) {
            if (timerId) {
                clearTimeout(timerId);
            }
            timerId = setTimeout(() => {
                fn(...args);
                timerId = null;
            }, delay);
        };
    }

    const updatePassword = (password) => {
        let uri = `/api/${TABLEAU_API_VERSION}/sites/${this.about.tableau_server.site_id}/users/${this.about.payload.tableau_site_user_id}`;
        let payload = `<tsRequest><user password="${password}"/></tsRequest>`;
        return new Promise((resolve, reject) => {
            put(uri, {contentType: 'application/xml', responseType: 'xml', payload})
                .then(response => {
                    resolve(response);
                })
                .catch(xmlResponseDoc => {
                    reject(xmlResponseDoc.querySelector('summary').textContent + ': ' + xmlResponseDoc.querySelector('detail').textContent);
                });
        });
    }

    const logout = () => {
        let form = document.createElement('form');
        form.style.visibility = 'hidden';
        form.method = 'POST';
        form.action = '/logout';
        document.body.appendChild(form);
        form.submit();
    }

    // Sort favorites first (alphabetically by name) and then the rest (alphabetically by name)
    const viewSort = (a, b) => {
        if (!a.isFavorite && b.isFavorite) {
            return 1;
        } else if (a.isFavorite && !b.isFavorite) {
            return -1;
        }
        return (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0;
    }

    const getQueryStringParamsAsObject = () => {
        let params = new URLSearchParams(window.location.search),
            filters={};// {name:{type,values}},

        for (const param of params.entries()) {
            let key = param[0], value = param[1];
            if (filters.hasOwnProperty(key)) {
                filters[key].push(value);
            }  else {
                filters[key] = [value];
            }
        }
        return filters;
    }

    const onParamChange = (param) => {
        let name = param.getName(),
            value = param.getCurrentValue(),
            paramsToApply = {}; //{name:[values]}
        paramsToApply[name] = [value.value]; //{name:[values]}

        updateQueryString(paramsToApply);
    }

    const onFilterChange = (filter) => {
        let name = filter.getFieldName(),
            filterType = filter.getFilterType(),
            paramsToApply = {}; //{name:[values]}

        switch (filterType) {
            case tableau.FilterType.CATEGORICAL: {
                if (filter.getIsAllSelected()) {
                    paramsToApply[name] = [];
                } else {
                    paramsToApply[name] = filter.getAppliedValues().map(x=>x.value);
                }
                break;
            }
        }
        updateQueryString(paramsToApply);
    }

    const updateQueryString = (paramsToApply) => {
        let params = new URLSearchParams(window.location.search);
        Object.keys(paramsToApply).forEach(paramName=>{
            if (params.has(paramName)) {
                params.delete(paramName)
            }
            for (const entery of paramsToApply[paramName]) {
                params.append(paramName, entery);
            }
        })
        let querysString = params.toString()
        let newUrl = `${window.location.pathname}${ querysString.length ? `?${querysString}` : '' }`;
        history.pushState({state: 'filtering'}, 'Filter', newUrl);
    }

    window.zwaf = {
        getAbout,
        getWorkbooks,
        getViews,
        getProjects,
        getViz,

        setViz,

        addViewToFavorites,
        deleteViewFromFavorites,

        getQueryStringParamsAsObject,

        updatePassword,
        logout
    };

}());

