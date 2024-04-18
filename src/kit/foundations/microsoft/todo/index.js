const {Request} = require("cross-fetch")
const {Readable} = require("node:stream")

const {validateAccessToken} = require("../../../../microsoft/clients/graph/tools");
const {BatchResponseContent} = require("@microsoft/microsoft-graph-client");

class IterationBrakeStream extends Readable {
    constructor(options) {
        super(options);
    }

    _read(size) {
    }
}

class ChecklistItem {
    constructor(id, _listId, _taskId, _graph) {
        this.id = id
        this._taskId = _taskId
        this._listId = _listId
        this._graph = _graph
        this._path = `/me/todo/lists/${this._listId}/tasks/${this._taskId}/checklistItems/${this.id}`
        this._methodsMap = {
            get: ["GET", this._path],
            edit: ["PATCH", this._path, true],
            delete: ["DELETE", this._path],
        }
    }

    get = async () => {
        return await this._graph.api(this._path).get()
    }

    edit = async (payload) => {
        return await this._graph.api(this._path).patch(payload)
    }

    delete = async () => {
        return await this._graph.api(this._path).delete()
    }

    batchStep = Todo._batchStepCreator(this)
}

class Task {
    constructor(id, _listId, _graph) {
        this.id = id
        this._listId = _listId
        this._graph = _graph
        this._path = `/me/todo/lists/${this._listId}/tasks/${this.id}`
        this._checklistItemsPath = `/me/todo/lists/${this._listId}/tasks/${this.id}/checklistItems`
        this._methodsMap = {
            get: ["GET", this._path],
            edit: ["PATCH", this._path, true],
            delete: ["DELETE", this._path],
            create: ["POST", this._checklistItemsPath, true],
            checklistItems: ["GET", this._checklistItemsPath]
        }
    }

    get = async () => await this._graph.api(this._path).get()

    edit = async (payload) => await this._graph.api(this._path).patch(payload)

    delete = async () => await this._graph.api(this._path).delete()

    checklistItem = (id) => new ChecklistItem(id, this._listId, this.id, this._graph)

    checklistItems = async () => {
        const {value} = await this._graph.api(this._checklistItemsPath).get()
        return value
    }

    create = async (payload) => await this._graph.api(this._checklistItemsPath)?.create(payload)

    batchStep = Todo._batchStepCreator(this)
}

class TaskList {
    constructor(id, _graph) {
        this.id = id
        this._graph = _graph
        this._path = `/me/todo/lists/${this.id}`
        this._tasksPath = `/me/todo/lists/${this.id}/tasks`
        this._methodsMap = {
            get: ["GET", this._path],
            create: ["POST", this._tasksPath, true],
            tasks: ["GET", this._tasksPath]
        }
    }

    task = (id) => new Task(id, this.id, this._graph)

    async* _tasksGenerator(pageSize, generationBrakeStream, _nextURL) {
        let brake = false

        generationBrakeStream?.on(
            "data",
            () => {
                brake = true
            }
        )

        const {value, "@odata.nextLink": nextURL} = await this._graph.api(_nextURL || this._tasksPath)
            .orderby("lastModifiedDateTime desc")
            .top(pageSize)
            .get()

        for (const task of value) {
            yield task
            if (brake) {
                yield false
                return;
            }
        }

        if (nextURL) {
            yield* await this._tasksGenerator(pageSize, generationBrakeStream, nextURL)
        } else {
            yield false
        }
    }

    async* tasks(pageSize, callback = async () => false) {
        const generationBrakeStream = new IterationBrakeStream()
        let page = []

        for await (const task of this._tasksGenerator(pageSize, generationBrakeStream)) {
            if (task) page.push(task)

            if (page.length === pageSize) {

                yield page

                if (await callback(page)) {
                    generationBrakeStream.push("")
                    return;
                }

                page = []
            }

            if (!task && page.length) {
                await callback(page)
                yield page
            }
        }
    }

    get = async () => await this._graph.api(this._path).get()

    create = async (payload) => await this._graph.api(this._tasksPath)?.create(payload)

    batchStep = Todo._batchStepCreator(this)
}

class Todo {
    constructor(graph, z = null) {
        this._graph = graph
        if (z) {
            this.validateAccessToken = async () => await validateAccessToken(this._graph, z)
        }
        this._path = `/me/todo`
        this._tasklistsPath = `/me/todo/lists`
        this._batchPath = `/$batch`
        this._methodsMap = {
            taskLists: ["GET", this._tasklistsPath],
            batch: ["POST", this._batchPath]
        }
    }

    taskList = (id) => new TaskList(id, this._graph)

    taskLists = async () => {
        const {value} = await this._graph.api(this._tasklistsPath).get()
        return value
    }

    batchStep = Todo._batchStepCreator(this)

    batch = async (batchContent) => new BatchResponseContent(await this._graph.api(this._batchPath).post(batchContent))

    static _batchStepCreator = (_this) => (id, method, payload) => {
        const [httpMethod, path, hasBody] = _this._methodsMap[method]
        return {
            id,
            request: new Request(
                path,
                {
                    method: httpMethod,
                    headers: {
                        "Content-type": "application/json",
                    },
                    ...(
                        hasBody && payload ? {
                            body: JSON.stringify(payload)
                        } : {}
                    )
                }
            )
        }
    }
}

exports.Todo = Todo