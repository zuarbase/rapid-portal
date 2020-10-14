<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE-edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>ZWAF - Login Page</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css"
          integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <link href="/css/style.css" rel="stylesheet">
</head>
<body class="login">
    <div class="login-bg-video">
        
    </div>
    <div class="login-form">
        <form action="/login" method="post">
            <div class="login-logo-image-wrapper">
            </div>
            <%doc>
            Space to put in text under the logo if needed.
            For example: Log in with your Tableau Server credentials.
            </%doc>
            <p class="helper-text">&nbsp;<p>
            %if error:
                <div class="alert alert-danger">${error}</div>
            %endif
            <div class="form-group">
                <input type="text" class="form-control" name="username" value="" placeholder="Username" required="required">
            </div>
            <div class="form-group">
                <input type="password" class="form-control" name="password" placeholder="Password" required="required">
            </div>
            <%doc>
            <input type="hidden" name="tableau_server_url" value="https://us-east-1.online.tableau.com">
            <input type="hidden" name="tableau_server_site" value="zuar">
            </%doc>
            <div class="form-group">
                <button type="submit" class="btn btn-primary btn-lg btn-block">Sign in</button>
            </div>
            <!-- Move to right before closing </body> tag for bottom of page positioning -->
            <div class="powered-by">
                <span>Powered by <a href="https://www.zuar.com/">Zuar</a></span>
            </div>
        </form>
    </div>
    <script>
        let form = document.querySelector('form');
        if (window.location.search) {
            form.action = form.action + window.location.search;
        }

        const urlParams = new URLSearchParams(window.location.search);
        let loc = urlParams.get('location');
        if (loc) {
            let input = document.createElement('input');
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', 'location');
            input.setAttribute('value', loc);
            form.appendChild(input);
        }
                let site = urlParams.get('site');
        if (site) {
            document.querySelector('.helper-text').innerHTML = 'Site: ' + site;
        }
        let username=urlParams.get('username');
        if (username) {
            let input = document.querySelector('input[name="username"]');
            input.setAttribute('value', username);
            input.setAttribute('type', 'hidden')

            let element = document.createElement('p')
            element.classList.add('form-control');
            element.innerHTML = username;

            input.parentNode.insertBefore(element, input);

            document.body.classList.add('embedded');
        }
    </script>
</body>
</html>
