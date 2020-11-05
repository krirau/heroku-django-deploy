const core = require('@actions/core');
const { execSync, exec } = require('child_process')

//Variables.
let heroku = {
    'app_name': core.getInput('heroku_app_name'),
    'api_key': core.getInput('heroku_api_key'),
    'email_address': core.getInput('heroku_email_address'),
    'want_to_login': core.getInput('want_to_just_login'),
    'use_git': core.getInput('use_git'),
    'use_docker': core.getInput('use_docker'),
    'use_build_manifest': core.getInput('use_build_manifest'),
    'disable_collect_static': core.getInput('disable_collect_static'),
    'force_push': core.getInput('force_push'),
}

//Create Netrc cat file used during login with cli.
const createNetrcFileForLogin = ({ email_address, api_key }) => {
    return execSync(`cat >~/.netrc <<EOF
machine api.heroku.com
  login ${email_address}
  password ${api_key}
machine git.heroku.com
  login ${email_address}
  password ${api_key}
        `);
}
//Login method to check if user is logged in.
login = () => {
    try {
        createNetrcFileForLogin(heroku);
        const user = execSync('heroku auth:whoami').toString();
        console.log(`Successfully Logged in with user: ${user}`);
    } catch (error) {
        console.log(error.message);
        core.setFailed(error.message);
    }
}

checkIfRepoIsShallow = () => {
    // Check if Repo clone is shallow
    const isShallow = execSync(
        "git rev-parse --is-shallow-repository"
    ).toString();

    // If the Repo clone is shallow, make it unshallow
    if (isShallow === "true\n") {
        execSync("git fetch --prune --unshallow");
    }
}

gitForcePush = () => {
    execSync("git pull heroku master")
    const push = execSync("git push -f heroku master").toString();
    console.log(push);
}
herokuForcePush = ({ app_name }) => {
    const push = execSync(`heroku container:push --force --app ${app_name} web`).toString();
    console.log(push);
}
disableCollectStatic = () => {
    const disableC = execSync("heroku config:set DISABLE_COLLECTSTATIC=1").toString();
    console.log(disableC);
}
//Adding remote repo to heroku.
addRemote = ({ app_name }) => {
    try {
        const gitInit = execSync('git init').toString();
        console.log(gitInit);
        const remote = execSync(`heroku git:remote -a ${app_name}`).toString();
        console.log(remote);
    } catch (error) {
        core.setFailed(error.message);
        console.log(error.message);
    }
}

deployWithBuildManifest = ({ use_build_manifest }) => {

}
deployWithDocker = ({ app_name, disable_collect_static, force_push }) => {
    try {
        console.log('Deploy using Container Registry ...');
        if (force_push) {
            herokuForcePush(heroku);
        } else {
            const push = execSync(`heroku container:push --app ${app_name} web`).toString();
            console.log(push);
        }
        if (disable_collect_static) {
            disableCollectStatic();
        }
        const migrate = execSync('heroku run python manage.py migrate').toString();
        console.log(migrate);
        console.log('Release ...');
        const release = execSync(`heroku container:release --app ${app_name} web`).toString();
        console.log(release);
    } catch (error) {
        console.log(error.message);
        core.setFailed(error.message);
    }
}
deployWithGit = () => {
    try {
        console.log('Deploying with git...');
        execSync(`git config user.name "Heroku-Django-Deploy"`);
        execSync(`git config user.email "${heroku.email_address}"`);
        const gadd = execSync("git add -A").toString();
        console.log(gadd);
        const status = execSync("git status --porcelain").toString().trim(); //checking if there is a modified file
        console.log(status);
        if (status) {
            execSync(`git commit -m "Initial commit"`).toString();
        }
        //before push check if it is shallow then unshallow if it is
        checkIfRepoIsShallow();
        if (heroku.disable_collect_static) {
            disableCollectStatic();
        }
        if (docker.force_push) {
            gitForcePush();
        } else {
            const push = execSync("git push heroku master").toString();
            console.log(push);
        }
        const migrate = execSync("heroku run python manage.py migrate").toString();
        console.log(migrate);
    } catch (error) {
        console.log(error.message);
        core.setFailed(error.message);
    }
}
pushAndRelease = ({ use_docker, use_git, use_build_manifest }) => {
    try {
        if (use_docker && !(use_git && use_build_manifest)) {
            deployWithDocker(heroku);
        } else if (use_git && !(use_docker && use_build_manifest)) {
            deployWithGit();
        }
        else if (use_build_manifest && !(use_git && use_docker)) {
            deployWithBuildManifest(heroku);
        }
        else if ((use_docker && use_git) === true || (use_build_manifest && use_git) == true || (use_build_manifest && use_docker && use_git) === true) {
            //Error only one deployment method at a time is allowed
            core.setFailed('Error : One deployment method at a time is allowed');
            console.log('Error : One deployment method at a time is allowed');
        } else {
            //Nothing is configured attempting to use default git
            console.log('No deployment method is specified. Attempting to use default use git...');
            deployWithGit();
        }
    } catch (error) {
        core.setFailed(error.message);
        console.log(error.message);
    }
}

//Run Login
// if (heroku.want_to_just_login) {
//     login();
//     return //, use return if user jus want to login
// }

login();
addRemote(heroku);
pushAndRelease(heroku);

core.setOutput(
    "status",
    "Successfully deployed app from branch"
);

