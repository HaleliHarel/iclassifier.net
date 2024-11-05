let projectStats,
    projectInfo = {
        descr: '',
        howtocite: '',
        open_for_browsing: null
    };

async function fetchStats() {
    let response = await fetch(`${dbAPIURL}/stats`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Could not fetch project statistics: ${error}`);
        return;
    }
    projectStats = await response.json();

    response = await fetch(`${dbAPIURL}/info`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Could not fetch project info: ${error}`);
        return;
    }
    const projectInfoData = await response.json();
    for (const key in projectInfoData)
        if (projectInfoData.hasOwnProperty(key))
            projectInfo[key] = projectInfoData[key];
}

async function submitProjectInfo() {
    console.log(projectInfo);
    const response = await fetch(`${dbAPIURL}/updateinfo`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        headers: {
            'Content-Type': 'text/plain'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(projectInfo)
    });
    if (!response.ok) {
        const error = await response.text();
        alert(`Updated failed: ${error}`);
        return;
    }
    alert('Update successful.');
}