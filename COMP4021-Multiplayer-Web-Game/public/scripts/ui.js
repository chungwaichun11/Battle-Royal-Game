const SignInForm = (function() {
    const SubmitMode = { Login: 0, Signup: 1 }
    let mode = SubmitMode.Login;
    
    function initialize() {
        
        Authentication.validate(() => {
            $("#modal-window").hide();
            ContinueBtn.show();
            Socket.connect();
        }, () => {
            show();
        });

        $("#login-tab").click(() => {
            mode = SubmitMode.Login;
            $("#login-tab").addClass("active");
            $("#signup-tab").removeClass("active");

            $("#confirm-password-title").hide();
            $("#displayname-title").hide();
            $("#confirm-password-field").hide();
            $("#display-name-field").hide();

            $("#signin-error").html("");
        });

        $("#signup-tab").click(() => {
            mode = SubmitMode.Signup;
            $("#login-tab").removeClass("active");
            $("#signup-tab").addClass("active");

            $("#confirm-password-title").show();
            $("#displayname-title").show();
            $("#confirm-password-field").show();
            $("#display-name-field").show();

            $("#signin-error").html("");
        });

        $(".signin-btn").click(() => {
            if(mode == SubmitMode.Login) {
                const username = $("#username-field").val().trim();
                const password = $("#password-field").val().trim();
    
                Authentication.signIn(username, password, () => {
                    hide();
                    Socket.connect();
                }, (error) => {
                    $("#signin-error").html(error);
                });
            } else {
                const username = $("#username-field").val().trim();
                const name = $("#display-name-field").val().trim();
                const password = $("#password-field").val().trim();
                const confirmPassword = $("#confirm-password-field").val().trim();
    
                if(password != confirmPassword) {
                    $("#signin-error").html("Passwords do not match");
                    return;
                }
    
                Authentication.signUp(username, name, password, () => {
                    hide();
                    Socket.connect();
                }, (error) => {
                    $("#signin-error").html(error);
                });
            }
        });

    }
    
    function show() {
        ModalWindow.show();
        $("#signin-form").fadeIn(500);
    }

    function hide() {
        ModalWindow.hide();
        $("#signin-form").fadeOut(500);
        Game.allowSound();
        Game.playBgm();
    }

    return { initialize, show, hide }
})();

const ModalWindow = (function() {

    let currentpage = 1;
    const maxPage = 5;
    $("#info-page-current").html(currentpage);

    function initialize() {
        $("#info-page-prev-btn").click(() => {
            currentpage -= 1; 
            $("#info-page-current").html(currentpage);
            
            for(let i = 1; i <= maxPage; i++) $("#info-content-page-" + i).hide();
            $("#info-content-page-" + currentpage).fadeIn();
            
            $("#info-page-next-btn").prop("disabled", false);
            if(currentpage == 1) $("#info-page-prev-btn").prop("disabled", true);
        });

        $("#info-page-next-btn").click(() => {
            currentpage = Math.min(maxPage, currentpage+1);
            $("#info-page-current").html(currentpage);

            for(let i = 1; i <= maxPage; i++) $("#info-content-page-" + i).hide();
            $("#info-content-page-" + currentpage).fadeIn();

            $("#info-page-prev-btn").prop("disabled", false);
            if(currentpage == maxPage) $("#info-page-next-btn").prop("disabled", true);
        });
    }

    function show() {
        $("#modal-overlay").css("display", "flex");
    }

    function hide() {
        $("#modal-overlay").fadeOut();
    }

    return { initialize, show, hide }
})();

const ScoreBoard = (function() {

    $(".back-btn").click(hide);

    function update(scores) {
        if(scores.teamrank == 1) $("#scoreboard-teamrank").html("You are the champion!");
        else $("#scoreboard-teamrank").html("Your team ranked #" + scores.teamrank + " place.");

        const maxKills = scores.individual.reduce((acc, p) => Math.max(acc, p.kills), 0);
        const maxDamage = scores.individual.reduce((acc, p) => Math.max(acc, p.damage), 0);
        const minFriendlyFire = scores.individual.reduce((acc, p) => Math.min(acc, p.friendlyfire), Infinity);
        const maxLevel = scores.individual.reduce((acc, p) => Math.max(acc, p.level), 0);
        const maxScore = scores.individual.reduce((acc, p) => Math.max(acc, p.score), 0);


        $(".scoreboard").empty();
        $(".scoreboard").append($("<tr> <th>Rank</th> <th>Player</th> <th>Kill</th> <th>Damage</th> <th>level</th> <th>score</th> </tr>"));
        for(i in scores.individual) {
            $(".scoreboard").append(
                $(
                    "<tr> " +
                    "<td>" + (Number(i)+1) + "</td> " +
                    "<td>" + scores.individual[i].name + "</td> " + 
                    "<td " + (scores.individual[i].kills == maxKills                ? "style=\"color: #FADA5D\"" : "") + ">" + scores.individual[i].kills + "</td> " + 
                    "<td " + (scores.individual[i].damage == maxDamage              ? "style=\"color: #FADA5D\"" : "") + ">" + scores.individual[i].damage + "</td> " + 
                    "<td " + (scores.individual[i].level == maxLevel                ? "style=\"color: #FADA5D\"" : "") + ">" + scores.individual[i].level + "</td> " + 
                    "<td " + (scores.individual[i].score == maxScore                ? "style=\"color: #FADA5D\"" : "") + ">" + scores.individual[i].score + "</td> " + 
                    "</tr>")
            );
        }

        show();
    }

    function show() {
        ModalWindow.show();
        $("#scoreboard-window").show();
    }

    function hide() {
        ModalWindow.hide();
    }

    return { update, hide }
})();

const ContinueBtn = (function() {

    $("#continue-btn").click(hide);
    
    function show() {
        $("#modal-window").hide();
        $("#continue-btn").show();
    }

    function hide() {
        $("#continue-btn").hide();
        ModalWindow.hide();
        Game.allowSound();
        Game.playBgm();
    }

    return { show }
})();