var localStorage = window.localStorage;
storageInitList();

/**
 * initiate the list if empty
 */
function storageInitList()
{
    if (!localStorage.getItem('stodopidlyList')) {
        storageSaveList([]);
    }
}

/**
 * Saves an array list to storage
 * @param list
 */
function storageSaveList(list)
{
    localStorage.setItem('stodopidlyList', JSON.stringify(list));
    console.log(localStorage.getItem('stodopidlyList'));
}

/**
 * Gets and parses a list
 */
function storageGetList()
{
    return JSON.parse(localStorage.getItem("stodopidlyList"));
}

function storageSaveDeletedList(list)
{
    localStorage.setItem('stodopidlyDeletedList', JSON.stringify(list));
}

function storageGetDeletedList()
{
    return JSON.parse(localStorage.getItem("stodopidlyDeletedList"));
}
