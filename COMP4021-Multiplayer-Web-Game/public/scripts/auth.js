
const Authentication = (function() {

    let user = null;

    function getUser() { return user; }

    function signIn(username, password, onSuccess, onError) {
        const data = JSON.stringify({ username, password });
 
        fetch("/signin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: data
        }).then(res => res.json()).then(json => {
            if(json.status == "success") {
                user = json.user;
                onSuccess();
            } else if(json.status == "error") onError(json.error);
        }).catch(error => {
            onError(error);
        });
    }

    function signUp(username, name, password, onSuccess, onError) {
        const data = JSON.stringify({ username, name, password });
        
        fetch("/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: data
        }).then(res => res.json()).then(json => {
            if(json.status == "success") {
                user = json.user;
                onSuccess();
            } else if(onError) onError(json.error);
        }).catch(error => {
            onError(error);
        });
    }

    function validate (onSuccess, onError) {
        fetch("/validate").then(res => res.json()).then(json => {
            if(json.status == "error") onError(json.error);
            else if(json.status == "success") {
                user = json.user;
                onSuccess();
            }
        });
    }

    function signOut (onSuccess, onError) {
        fetch("/signout").then(res => res.json()).then(json => {
            if(json.status == "error") onError(json.error);
            else if(json.status == "success") onSuccess();
        });
    }

    return({ getUser, signIn, signUp, validate, signOut });
})();