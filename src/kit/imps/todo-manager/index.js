const {asyncIter2Array, sleep} = require("../../utils/async");
const {BatchRequestContent} = require("@microsoft/microsoft-graph-client");
const {Action} = require("../../foundations/bulk");
const _ = require('lodash');
const {tandemIter, diff, uniquify} = require("../../utils/iter");
const {createMeBatchStep} = require("../../../microsoft/clients/graph/tools");
const {Airtable} = require("../../foundations/airtable");
const {Todo} = require("../../foundations/microsoft/todo");
const createGraphClient = require("../../../microsoft/clients/graph");
const {detailedDiff, updatedDiff} = require("deep-object-diff");
const moment = require("moment-timezone")

class TodoManagerBase {
    constructor(
        {
            z,
            msAccessToken,
            airtableConfig: {
                apiKey: airtableAPIKey,
                baseId: airtableBaseId,
                idsTableId: airtableIdsTableId,
                dataTableId: airtableDataTableId,
                syncCheckpointsTableId: airtableSyncCheckpointsTableId
            },
            msTodoListId,
            timeZone
        }
    ) {
        this._todo = new Todo(
            createGraphClient(msAccessToken),
            z
        )

        if (z) {
            this.validateAccess = async () => {
                await this._todo.validateAccessToken()
            }
        }

        this._airtable = new Airtable(
            {
                apiKey: airtableAPIKey
            }
        )
        this._airtableBaseId = airtableBaseId
        this._airtableIdsTableId = airtableIdsTableId
        this._airtableDataTableId = airtableDataTableId
        this._airtableSyncCheckpointsTableId = airtableSyncCheckpointsTableId
        this._msTodoListId = msTodoListId
        this._timeZone = timeZone
        this._batchStepCreators = {
            create: {
                checklistItem: ({id, parentMicrosoftId, displayName, isChecked}) =>
                    this._todo
                        .taskList(this._msTodoListId)
                        .task(parentMicrosoftId)
                        .batchStep(
                            id,
                            'create',
                            {
                                displayName,
                                isChecked
                            }
                        ),
                task: ({id, title, startDateTime, dueDateTime, reminderDateTime, status}) =>
                    this._todo
                        .taskList(this._msTodoListId)
                        .batchStep(
                            id,
                            'create',
                            {
                                title,
                                startDateTime,
                                dueDateTime,
                                reminderDateTime,
                                status
                            }
                        ),
            },
            get: {
                checklistItem: ({id, parentMicrosoftId, microsoftId}) =>
                    this._todo
                        .taskList(this._msTodoListId)
                        .task(parentMicrosoftId)
                        .checklistItem(microsoftId)
                        .batchStep(
                            id,
                            'get'
                        ),
                task: ({id, microsoftId}) =>
                    this._todo
                        .taskList(this._msTodoListId)
                        .task(microsoftId)
                        .batchStep(
                            id,
                            'get'
                        ),
            },
            edit: {
                checklistItem: ({id, parentMicrosoftId, microsoftId, displayName, isChecked}) =>
                    this._todo
                        .taskList(this._msTodoListId)
                        .task(parentMicrosoftId)
                        .checklistItem(microsoftId)
                        .batchStep(
                            id,
                            'edit',
                            {
                                displayName,
                                isChecked
                            }
                        ),
                task: ({id, microsoftId, title, startDateTime, dueDateTime, reminderDateTime, status}) =>
                    this._todo
                        .taskList(this._msTodoListId)
                        .task(microsoftId)
                        .batchStep(
                            id,
                            'edit',
                            {
                                title,
                                startDateTime,
                                dueDateTime,
                                reminderDateTime,
                                status
                            }
                        ),
            },
            delete: {
                checklistItem: ({id, parentMicrosoftId, microsoftId}) =>
                    this._todo
                        .taskList(this._msTodoListId)
                        .task(parentMicrosoftId)
                        .checklistItem(microsoftId)
                        .batchStep(
                            id,
                            'delete'
                        ),
                task: ({id, microsoftId}) =>
                    this._todo
                        .taskList(this._msTodoListId)
                        .task(microsoftId)
                        .batchStep(
                            id,
                            'delete'
                        )
            }
        }
    }

    changeViaBatch = async (msBatchRequestContentsGenerator, extension = null, returnAsEntries = true, extConnection = ["id", "id"]) => {
        let fullRes = []

        for (const msBatchRequestContent of msBatchRequestContentsGenerator) {
            const res = await asyncIter2Array(
                await (
                    await (
                        await this._todo.batch(
                            await msBatchRequestContent?.getContent()
                        )
                    )
                ).getResponsesIterator(),
                async ([id, res]) => {
                    let body

                    try {
                        body = await res.json()
                    } catch (err) {
                        body = {}
                    }

                    return (
                        {
                            id,
                            body: body,
                            headers: Object.fromEntries(res.headers.entries())
                        }
                    )
                }
            )

            const [throttledRes, notThrottledRes] = _.partition(res, ({headers: {"retry-after": retryAfter}}) => !!retryAfter)

            let retryRes = [];

            if (throttledRes.length) {
                const {headers: {"retry-after": retryAfter}} = _.maxBy(
                    throttledRes,
                    ({headers: {"retry-after": retryAfter}}) => parseInt(retryAfter)
                )

                await sleep(
                    retryAfter
                    * 1000
                )

                retryRes = await this.changeViaBatch(
                    TodoManager._createMSBatchRequestContents(
                        throttledRes,
                        ({id}) => msBatchRequestContent.requests.get(id)
                    ),
                    extension
                )
            }

            fullRes.push(notThrottledRes.concat(retryRes))
        }

        fullRes = fullRes.flat()

        return extension ?
            Action.connect(
                fullRes,
                extension,
                extConnection?.at(0),
                extConnection?.at(1),
                "flat"
            ).map(
                ([id, resItem, extItem]) => (
                    returnAsEntries ?
                        [
                            id,
                            {
                                id,
                                ...resItem,
                                extension: extItem
                            }
                        ] :
                        {
                            id,
                            ...resItem,
                            extension: extItem
                        }
                )
            ) :
            fullRes.map(
                ({id, ...data}) => returnAsEntries ? [id, {id, ...data}] : {id, ...data}
            )
    }

    storeIds = async (cells) =>
        await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableIdsTableId)
            .bulkCreateByCells(
                cells,
                ["notionId", "microsoftId", "parentNotionId", "parentMicrosoftId"]
            )

    deleteIds = async (recordIds) =>
        await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableIdsTableId)
            .bulkDelete(recordIds)

    storeData = async (cells) =>
        await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableDataTableId)
            .bulkCreateByCells(
                cells,
                ["notionId", "microsoftId", "notionData", "microsoftData"]
            )

    editData = async (cells) => {
        await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableDataTableId)
            .bulkEditByCells(
                cells,
                ["notionId", "microsoftId", "notionData", "microsoftData"]
            )
    }

    deleteData = async (recordIds) =>
        await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableDataTableId)
            .bulkDelete(recordIds)
}

class TodoManagerTasksHandler extends TodoManagerBase {
    constructor(props) {
        super(props);
        this.notionTasksList = []
    }

    provide = (notionTasksList) => {
        this.notionTasksList = notionTasksList
    }

    msInputs = async function* () {
    }

    apply = async () => {
        let initialMSResponseContent = new Map(),
            lastMSResponseContent = new Map()

        let [refreshInputs, msInputs] = _.partition(
            await asyncIter2Array(
                this.msInputs()
            ),
            ({type, operation}) => type === 'task' && operation === 'get'
        )

        refreshInputs = uniquify(refreshInputs)
        msInputs = uniquify(msInputs)

        let [bendingChecklistItemsInputs, restInputs] = _.partition(
            msInputs,
            ({type, bending}) => type === 'checklistItem' && bending
        )

        initialMSResponseContent = new Map(
            await this.changeViaBatch(
                TodoManager._createMSBatchRequestContents(
                    restInputs,
                    ({type, operation, ...input}) => this._batchStepCreators?.[operation]?.[type]?.(input)
                ),
                restInputs
            )
        )

        if (bendingChecklistItemsInputs.length) {
            bendingChecklistItemsInputs = bendingChecklistItemsInputs.map(
                ({parentNotionId, ...inputs}) => ({
                    parentNotionId,
                    ...inputs,
                    parentMicrosoftId: initialMSResponseContent.get(parentNotionId)?.body?.id
                })
            )

            msInputs = restInputs.concat(bendingChecklistItemsInputs)

            lastMSResponseContent = new Map(
                await this.changeViaBatch(
                    TodoManager._createMSBatchRequestContents(
                        bendingChecklistItemsInputs,
                        ({id, type, operation, notionId, parentNotionId, parentMicrosoftId, displayName, isChecked}) =>
                            this._batchStepCreators?.[operation]?.[type]?.(
                                {id, notionId, parentNotionId, parentMicrosoftId, displayName, isChecked}
                            )
                    ),
                    bendingChecklistItemsInputs
                )
            )
        }

        const msResponseContent = new Map([...initialMSResponseContent, ...lastMSResponseContent])
        const [msDeleteResponseContentValues, msRestResponseContentValues] = _.partition(Array.from(msResponseContent.values()), ({extension: {operation}}) => operation === 'delete')

        refreshInputs = refreshInputs.filter(({id}) => !msResponseContent.get(id))

        return uniquify(
            (
                msRestResponseContentValues.length ?
                    await this.changeViaBatch(
                        TodoManager._createMSBatchRequestContents(
                            msRestResponseContentValues,
                            ({
                                 body: {id: microsoftId},
                                 extension: {id, type, notionId, parentNotionId, parentMicrosoftId}
                             }) => this._batchStepCreators?.get?.[type]?.(
                                {
                                    id,
                                    notionId,
                                    parentNotionId,
                                    parentMicrosoftId,
                                    microsoftId
                                }
                            )
                        ),
                        msInputs,
                        false
                    ) : []
            ).concat(
                refreshInputs.length ?
                    await this.changeViaBatch(
                        TodoManager._createMSBatchRequestContents(
                            refreshInputs,
                            ({id, type, notionId, microsoftId}) =>
                                this._batchStepCreators?.get?.[type]?.(
                                    {
                                        id,
                                        notionId,
                                        microsoftId
                                    }
                                )
                        ),
                        refreshInputs,
                        false
                    ) : []
            ).concat(
                msDeleteResponseContentValues
            )
        ) || []
    }
}

class TodoManagerEditedTasksHandler extends TodoManagerTasksHandler {
    constructor(props, _sub = false) {
        super(props);
        this._props = props
        this._sub = _sub
    }

    msInputs = async function* msInputs() {
        const pastTasksIds = []
        const pastChecklistItemsEntries = []
        const editedChecklistItemsEntries = []
        const newChecklistItemsEntries = []
        const subNotionTasksList = []

        const cd = Action.connect(
            this.notionTasksList,
            await this._airtable
                .base(this._airtableBaseId)
                .table(this._airtableDataTableId)
                .getAll(
                    {
                        notionId: this.notionTasksList.map(({id}) => id)
                    }
                ),
            "id",
            "fields.notionId",
            "entries"
        )

        const cdm = new Map(cd)

        const msInputsList = TodoManager._createMSInputsList(
            TodoManager._diffNotionTasksInCD(cd),
            this._timeZone
        )

        for (
            const {
                notionId,
                title,
                startDateTime,
                dueDateTime,
                reminderDateTime,
                status,
                checked,
                deleted,
                editedParentNotionIds,
                childrenNotionIds
            } of msInputsList
            ) {
            const {pastParentNotionIds, restParentNotionIds, newParentNotionIds} = editedParentNotionIds
            const [, [{id: airtableRecordId, fields: {microsoftId}}]] = cdm.get(notionId);

            if (
                [
                    title,
                    startDateTime,
                    dueDateTime,
                    reminderDateTime,
                    status,
                    checked,
                    deleted
                ].filter(Boolean).length
            ) {

                yield (
                    {
                        type: "task",
                        ...(
                            deleted ?
                                {
                                    operation: "delete",
                                    notionId,
                                    id: notionId,
                                    microsoftId,
                                    airtableRecordId
                                } :
                                {
                                    operation: "edit",
                                    notionId,
                                    id: notionId,
                                    microsoftId,
                                    airtableRecordId,
                                    ...(title ? {title} : {}),
                                    ...(startDateTime ? {startDateTime} : {}),
                                    ...(dueDateTime ? {dueDateTime} : {}),
                                    ...(reminderDateTime ? {reminderDateTime} : {}),
                                    ...(status ? {status} : {}),
                                }
                        ),

                    }
                )

                if ((title !== undefined) || (checked !== undefined)) {
                    editedChecklistItemsEntries.push(
                        ...(
                            restParentNotionIds.map(
                                parentNotionId =>
                                    [
                                        parentNotionId,
                                        notionId,
                                        {
                                            ...(title !== undefined ? {displayName: title} : {}),
                                            ...(checked !== undefined ? {isChecked: checked} : {})
                                        }
                                    ]
                            )
                        )
                    )
                }

            } else {
                if (!this._sub) {
                    yield {
                        type: "task",
                        operation: "get",
                        id: notionId,
                        notionId,
                        microsoftId,
                        airtableRecordId
                    }
                }
            }

            pastChecklistItemsEntries.push(
                ...(
                    pastParentNotionIds.map(
                        parentNotionId => [parentNotionId, notionId]
                    )
                )
            )

            if (deleted) {

                pastChecklistItemsEntries.push(
                    ...(
                        restParentNotionIds.map(
                            parentNotionId => [parentNotionId, notionId]
                        )
                    )
                )

                pastTasksIds.push(
                    ...childrenNotionIds
                )

            } else {

                newChecklistItemsEntries.push(
                    ...(
                        newParentNotionIds.map(
                            parentNotionId => {
                                const [, [{fields: {microsoftData}}]] = cdm.get(notionId)
                                const {title: pastTitle, status: pastStatus} = JSON.parse(microsoftData)
                                return [
                                    parentNotionId,
                                    notionId,
                                    {
                                        displayName: title || pastTitle,
                                        isChecked: checked || pastStatus === 'completed'
                                    }
                                ]
                            }
                        )
                    )
                )

            }

        }

        const checklistItemEntries = [
            ...pastChecklistItemsEntries,
            ...editedChecklistItemsEntries,
            ...newChecklistItemsEntries,
        ]

        await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableDataTableId)
            .getAll(
                {
                    notionId:
                        checklistItemEntries.concat(pastTasksIds.map(notionId => [notionId]))
                            .filter(([parentNotionId]) => !cdm.get(parentNotionId))
                            .map(([parentNotionId]) => parentNotionId)
                }
            )

        await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableIdsTableId)
            .getAll(
                {
                    parentNotionId: {
                        notionId: editedChecklistItemsEntries.concat(pastChecklistItemsEntries).map(([parentNotionId, notionId]) => [parentNotionId, notionId])
                    }
                }
            )

        for (const [parentNotionId, notionId] of pastChecklistItemsEntries) {
            const {id: airtableRecordId, fields: {microsoftId, parentMicrosoftId} = {}} =
                this._airtable
                    .base(this._airtableBaseId)
                    .table(this._airtableIdsTableId)
                    .getOneFromCache(
                        {
                            parentNotionId: {
                                notionId: [[parentNotionId, notionId]]
                            }
                        }
                    )

            yield {
                type: "checklistItem",
                operation: "delete",
                id: TodoManager._createBatchRequestId(parentNotionId, notionId),
                notionId,
                parentNotionId,
                microsoftId,
                parentMicrosoftId,
                airtableRecordId
            }
        }

        for (const [parentNotionId, notionId, {displayName, isChecked}] of editedChecklistItemsEntries) {
            const {id: airtableRecordId, fields: {microsoftId, parentMicrosoftId} = {}} =
                this._airtable
                    .base(this._airtableBaseId)
                    .table(this._airtableIdsTableId)
                    .getOneFromCache(
                        {
                            parentNotionId: {
                                notionId: [[parentNotionId, notionId]]
                            }
                        }
                    )

            yield {
                type: "checklistItem",
                operation: "edit",
                id: TodoManager._createBatchRequestId(parentNotionId, notionId),
                notionId,
                parentNotionId,
                microsoftId,
                parentMicrosoftId,
                airtableRecordId,
                ...(displayName !== undefined ? {displayName} : {}),
                ...(isChecked !== undefined ? {isChecked} : {})
            }
        }

        for (const [parentNotionId, notionId, {displayName, isChecked}] of newChecklistItemsEntries) {

            const {fields: {microsoftId: parentMicrosoftId} = {}} =
            cdm.get(parentNotionId)?.at(1)?.at(0) ||
            this._airtable
                .base(this._airtableBaseId)
                .table(this._airtableDataTableId)
                .getOneFromCache(
                    {
                        notionId: parentNotionId
                    }
                ) || {}

            yield {
                type: "checklistItem",
                operation: "create",
                id: TodoManager._createBatchRequestId(parentNotionId, notionId),
                notionId,
                parentNotionId,
                parentMicrosoftId,
                displayName,
                isChecked
            }
        }

        for (const [notionId] of checklistItemEntries) {
            const {id: airtableRecordId, fields: {microsoftId}} =
                this._airtable
                    .base(this._airtableBaseId)
                    .table(this._airtableDataTableId)
                    .getOneFromCache(
                        {
                            notionId: notionId
                        }
                    )

            if (!this._sub) {
                yield {
                    type: "task",
                    operation: "get",
                    id: notionId,
                    notionId,
                    microsoftId,
                    airtableRecordId
                }
            }

        }

        for (const notionId of pastTasksIds) {
            const {fields: {notionData} = {}} =
            cdm.get(notionId)?.at(1)?.at(0) ||
            this._airtable
                .base(this._airtableBaseId)
                .table(this._airtableDataTableId)
                .getOneFromCache(
                    {
                        notionId
                    }
                ) || {}

            const subNotionTask = JSON.parse(notionData)

            _.set(subNotionTask, 'archived', true)

            subNotionTasksList.push(
                subNotionTask
            )
        }

        if (subNotionTasksList.length) {
            const subEditedTaskDetector = new TodoManagerEditedTasksHandler(this._props, true)
            subEditedTaskDetector.provide(subNotionTasksList)
            yield* subEditedTaskDetector.msInputs()
        }

    }
}

class TodoManagerNewTasksHandler extends TodoManagerTasksHandler {
    constructor(props) {
        super(props);
    }

    msInputs = async function* () {
        const msInputsList = TodoManager._createMSInputsList(this.notionTasksList, this._timeZone)
        const msInputsMap = TodoManager._createMSInputsMap(msInputsList)
        const newChecklistItemsEntries = []

        for (
            const {
                notionId,
                title,
                startDateTime,
                dueDateTime,
                reminderDateTime,
                status,
                checked,
                parentNotionIds
            } of msInputsList
            ) {
            yield (
                {
                    type: "task",
                    operation: "create",
                    notionId,
                    id: notionId,
                    title,
                    startDateTime,
                    dueDateTime,
                    reminderDateTime,
                    status
                }
            )

            for (const parentNotionId of parentNotionIds) {

                newChecklistItemsEntries.push(
                    ...(
                        parentNotionIds.map(
                            parentNotionId =>
                                [
                                    parentNotionId,
                                    notionId,
                                    {
                                        displayName: title,
                                        isChecked: checked
                                    }
                                ]
                        )
                    )
                )

            }
        }

        await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableDataTableId)
            .getAll(
                {
                    notionId: newChecklistItemsEntries
                        .filter(([parentNotionId]) => !msInputsMap.get(parentNotionId))
                        .map(([parentNotionId]) => parentNotionId)
                }
            )

        for (const [parentNotionId, notionId, {displayName, isChecked}] of newChecklistItemsEntries) {

            const {fields: {microsoftId: parentMicrosoftId} = {}} = await this._airtable
                .base(this._airtableBaseId)
                .table(this._airtableDataTableId)
                .getOneFromCache(
                    {
                        notionId: parentNotionId
                    }
                ) || {}

            yield {
                type: "checklistItem",
                operation: "create",
                id: TodoManager._createBatchRequestId(parentNotionId, notionId),
                notionId,
                parentNotionId,
                ...(parentMicrosoftId ? {parentMicrosoftId} : {bending: true}),
                displayName,
                isChecked
            }
        }

    }
}

class TodoManagerTasksDetector extends TodoManagerBase {
    constructor(props) {
        super(props);
        this._checkpointDate = undefined
    }

    _getCheckpointDate = async () => {
        const {fields: {date} = {}} = await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableSyncCheckpointsTableId)
            .getByArguments(
                {
                    sort: [
                        {
                            field: "date",
                            direction: "desc"
                        }
                    ]
                },
                true
            ) || {}

        this._checkpointDate = date ? new Date(date) : undefined

        return this._checkpointDate
    }

    _setCheckpointDate = async () => {
        const now = new Date()

        const [{fields: {date} = {}}] = await this._airtable
            .base(this._airtableBaseId)
            .table(this._airtableSyncCheckpointsTableId)
            .bulkCreate(
                [
                    {
                        date: now
                    }
                ]
            ) || [{}]

        this._checkpointDate = date ? now : undefined

        return this._checkpointDate
    }

    async* _generatePatches(connectedDataset, unconnectedDataset) {
        const checklistItemBendingEdits = []
        const taskBendingIncompleteEdits = []
        const taskBendingEdits = []
        const taskBendingIncompleteDeletes = []
        const taskBendingDeletes = []

        for (const {
            microsoftId: parentMicrosoftId,
            notionId,
            airtableId,
            pastProps: {
                startDateTime: pastStartDateTime,
                dueDateTime: pastDueDateTime
            },
            updatedProps: {
                title,
                status,
                detailedTitle = {},
                startDateTime,
                dueDateTime
            },
            updatedChecklistItems: {
                past: pastChecklistItems,
                edited: editedChecklistItems,
                new: newChecklistItems
            },
            microsoftData
        } of TodoManager._diffTodoTasksInCD(connectedDataset)) {

            const checked = status !== undefined ? status === 'completed' : null

            yield {
                operation: "edit",
                target: "notion",
                type: "task",
                ids: {
                    notionId,
                    microsoftId: parentMicrosoftId,
                    airtableId,
                },
                data: _.pickBy(
                    {
                        ...detailedTitle,
                        checked,
                        start: TodoManager._getDateFromMSDateTimeTimeZone(startDateTime)?.toISOString(true),
                        end: TodoManager._getDateFromMSDateTimeTimeZone(dueDateTime)?.toISOString(true)
                    },
                    _.identity()
                ),
                syncData: {
                    microsoftData: microsoftData
                }
            }

            taskBendingIncompleteEdits.push(
                ...editedChecklistItems.map(
                    ({id: microsoftId, displayName, isChecked}) => (
                        {
                            microsoftId,
                            parentMicrosoftId,
                            data: {
                                ...(displayName !== undefined ? {title: displayName} : {}),
                                ...(isChecked !== undefined ? {
                                    status: isChecked ? "completed" : "notStarted",
                                    checked: isChecked
                                } : {})
                            }
                        }
                    )
                )
            )

            taskBendingIncompleteDeletes.push(
                ...pastChecklistItems.map(
                    ({id: microsoftId}) => (
                        {
                            microsoftId,
                            parentMicrosoftId
                        }
                    )
                )
            )

            for (const {id: microsoftId, displayName, isChecked} of newChecklistItems) {
                yield {
                    operation: "create",
                    target: "notion",
                    type: "task",
                    ids: {
                        microsoftId,
                        parentNotionId: notionId,
                        parentMicrosoftId
                    },
                    data: _.pickBy(
                        {
                            ...TodoManager._covertTodoTaskTitleToObject(displayName),
                            checked: isChecked,
                            start: TodoManager._getDateFromMSDateTimeTimeZone(startDateTime || pastStartDateTime)?.toISOString(true),
                            end: TodoManager._getDateFromMSDateTimeTimeZone(dueDateTime || pastDueDateTime)?.toISOString(true)
                        },
                        _.identity()
                    ),
                    syncDataBending: true
                }

                yield {
                    operation: "create",
                    target: "microsoft",
                    type: "task",
                    ids: {
                        microsoftId,
                        parentNotionId: notionId,
                        parentMicrosoftId
                    },
                    data: _.pickBy(
                        {
                            title: displayName,
                            status: isChecked !== undefined ? isChecked ? "completed" : "notStarted" : null,
                            startDateTime: TodoManager._createMSDateTimeTimeZone(
                                startDateTime?.dateTime || pastStartDateTime?.dateTime,
                                this._timeZone
                            ),
                            dueDateTime: TodoManager._createMSDateTimeTimeZone(
                                dueDateTime?.dateTime || pastDueDateTime?.dateTime,
                                this._timeZone
                            )
                        },
                        _.identity()
                    )
                }
            }

            if (title || status) {
                checklistItemBendingEdits.push(
                    {
                        notionId,
                        data: {
                            ...(title !== undefined ? {displayName: title} : {}),
                            ...(status !== undefined ? {isChecked: checked} : {})
                        }
                    }
                )
            }
        }

        for (const [, {data}, {fields: {notionId, microsoftId, parentMicrosoftId, parentNotionId}}] of Action.connect(
            checklistItemBendingEdits,
            await this._airtable
                .base(this._airtableBaseId)
                .table(this._airtableIdsTableId)
                .getAll(
                    {
                        notionId: checklistItemBendingEdits.map(({notionId}) => notionId)
                    }
                ),
            "notionId",
            "fields.notionId",
            "flat"
        )) {
            yield {
                operation: "edit",
                target: "microsoft",
                type: "checklistItem",
                ids: {
                    notionId,
                    parentNotionId,
                    microsoftId,
                    parentMicrosoftId,
                },
                data
            }

            yield {
                operation: "get",
                target: "microsoft",
                type: "task",
                ids: {
                    notionId: parentNotionId,
                    microsoftId: parentMicrosoftId
                }
            }
        }

        taskBendingEdits.push(
            ...(
                Action.connect(
                    taskBendingIncompleteEdits,
                    (
                        await this._airtable
                            .base(this._airtableBaseId)
                            .table(this._airtableIdsTableId)
                            .getAll(
                                {
                                    microsoftId: {
                                        parentMicrosoftId: taskBendingIncompleteEdits.map(
                                            (
                                                {
                                                    microsoftId,
                                                    parentMicrosoftId
                                                }
                                            ) => [microsoftId, parentMicrosoftId])
                                    }
                                }
                            )
                    ),
                    "microsoftId",
                    "fields.microsoftId",
                    "flat"
                ).map(
                    ([, {data}, {fields: {notionId}}]) => (
                        {
                            notionId,
                            data
                        }
                    )
                )
            )
        )

        taskBendingDeletes.push(
            ...(
                Action.connect(
                    taskBendingIncompleteDeletes,
                    (
                        await this._airtable
                            .base(this._airtableBaseId)
                            .table(this._airtableIdsTableId)
                            .getAll(
                                {
                                    microsoftId: {
                                        parentMicrosoftId: taskBendingIncompleteDeletes.map(
                                            (
                                                {
                                                    microsoftId,
                                                    parentMicrosoftId
                                                }
                                            ) => [microsoftId, parentMicrosoftId])
                                    }
                                }
                            )
                    ),
                    "microsoftId",
                    "fields.microsoftId",
                    "flat"
                ).map(
                    ([, , {id: idsTableAirtableId, fields: {notionId}}]) => (
                        {
                            notionId,
                            idsTableAirtableId
                        }
                    )
                )
            )
        )

        for (const [, {data}, {id: airtableId, fields: {notionId, microsoftId}}] of Action.connect(
            taskBendingEdits,
            await this._airtable
                .base(this._airtableBaseId)
                .table(this._airtableDataTableId)
                .getAll(
                    {
                        notionId: taskBendingEdits.map(({notionId}) => notionId)
                    }
                ),
            "notionId",
            "fields.notionId",
            "flat"
        )) {
            const {title, checked, status} = data

            yield {
                operation: "edit",
                target: "notion",
                type: "task",
                ids: {
                    notionId,
                    microsoftId,
                    airtableId,
                },
                data: _.pickBy(
                    {
                        ...TodoManager._covertTodoTaskTitleToObject(title),
                        checked,
                    },
                    _.identity()
                ),
                syncDataBending: true
            }

            yield {
                operation: "edit",
                target: "microsoft",
                type: "task",
                ids: {
                    notionId,
                    microsoftId,
                    airtableId,
                },
                data: _.pickBy(
                    {
                        title,
                        status
                    },
                    _.identity()
                )
            }
        }

        for (const [, {idsTableAirtableId}, {id: airtableId, fields: {notionId, microsoftId}}] of Action.connect(
            taskBendingDeletes,
            await this._airtable
                .base(this._airtableBaseId)
                .table(this._airtableDataTableId)
                .getAll(
                    {
                        notionId: taskBendingDeletes.map(({notionId}) => notionId)
                    }
                ),
            "notionId",
            "fields.notionId",
            "flat"
        )) {
            yield {
                operation: "delete",
                target: "notion",
                type: "task",
                ids: {
                    notionId,
                    microsoftId,
                    idsTableAirtableId,
                    airtableId,
                }
            }

            yield {
                operation: "delete",
                target: "microsoft",
                type: "task",
                ids: {
                    notionId,
                    microsoftId,
                    idsTableAirtableId,
                    airtableId,
                }
            }
        }

        for (
            const {
                microsoftId: parentMicrosoftId,
                microsoftData,
                props: {
                    status,
                    detailedTitle = {},
                    startDateTime,
                    dueDateTime,
                    checklistItems
                }
            } of TodoManager._prepareTodoTasksInUCD(unconnectedDataset)
            ) {

            yield {
                operation: "create",
                target: "notion",
                type: "task",
                ids: {
                    microsoftId: parentMicrosoftId
                },
                data: _.pickBy(
                    {
                        ...detailedTitle,
                        checked: status !== undefined ? status === 'completed' : null,
                        start: TodoManager._getDateFromMSDateTimeTimeZone(startDateTime)?.toISOString(true),
                        end: TodoManager._getDateFromMSDateTimeTimeZone(dueDateTime)?.toISOString(true)
                    },
                    _.identity()
                ),
                syncData: {
                    microsoftData: microsoftData
                }
            }

            for (const {id: microsoftId, displayName, isChecked} of checklistItems || []) {
                yield {
                    operation: "create",
                    target: "notion",
                    type: "task",
                    ids: {
                        microsoftId,
                        parentMicrosoftId
                    },
                    data: _.pickBy(
                        {
                            ...TodoManager._covertTodoTaskTitleToObject(displayName),
                            checked: isChecked,
                            start: TodoManager._getDateFromMSDateTimeTimeZone(startDateTime)?.toISOString(true),
                            end: TodoManager._getDateFromMSDateTimeTimeZone(dueDateTime)?.toISOString(true)
                        },
                        _.identity()
                    ),
                    syncDataBending: true
                }

                yield {
                    operation: "create",
                    target: "microsoft",
                    type: "task",
                    ids: {
                        microsoftId,
                        parentMicrosoftId
                    },
                    data: _.pickBy(
                        {
                            title: displayName,
                            status: isChecked !== undefined ? isChecked ? "completed" : "notStarted" : null,
                            startDateTime: TodoManager._createMSDateTimeTimeZone(
                                startDateTime?.dateTime,
                                this._timeZone
                            ),
                            dueDateTime: TodoManager._createMSDateTimeTimeZone(
                                dueDateTime?.dateTime,
                                this._timeZone
                            )
                        },
                        _.identity()
                    )
                }
            }
        }
    }

    get = async () => {
        const checkpointDate = await this._getCheckpointDate()
        const notionPatchesGroups = {
            toEdit: [],
            toCreate: [],
            toDelete: [],
            toRefresh: []
        }
        const cd = []
        const ucd = []

        await asyncIter2Array(
            this._todo
                .taskList(this._msTodoListId)
                .tasks(
                    5,
                    async (page) => {

                        const [unsyncedTasks, syncedTasks] = _.partition(
                            page,
                            ({lastModifiedDateTime: lastModifiedDateTimeJSON}) => {
                                const lastModifiedDateTime = new Date(lastModifiedDateTimeJSON)
                                return (lastModifiedDateTime > checkpointDate) || !checkpointDate
                            }
                        )

                        const [_cd, _ucd] = Action.connect(
                            unsyncedTasks,
                            await this._airtable.base(this._airtableBaseId).table(this._airtableDataTableId).getAll(
                                {
                                    microsoftId: unsyncedTasks.map(({id}) => id)
                                }
                            ),
                            "id",
                            "fields.microsoftId",
                            "flat",
                            true
                        )

                        cd.push(
                            ..._cd
                        )

                        ucd.push(
                            ..._ucd
                        )

                        return syncedTasks?.length
                    }
                )
        )

        const patchesGroups = _.groupBy(
            await asyncIter2Array(this._generatePatches(cd, ucd)),
            ({operation, target, type}) => [operation, target, type].join("-")
        )

        const [editNotionTaskBending, editNotionTask] = _.partition(
            patchesGroups?.['edit-notion-task'],
            ({syncDataBending}) => syncDataBending
        )

        const [createNotionTaskBending, createNotionTask] = _.partition(
            patchesGroups?.['create-notion-task'],
            ({syncDataBending}) => syncDataBending
        )

        const deleteNotionTask = patchesGroups?.['delete-notion-task'] || []

        const editMicrosoftTask = patchesGroups?.['edit-microsoft-task'] || []
        const createMicrosoftTask = patchesGroups?.['create-microsoft-task'] || []

        const getMicrosoftTask = uniquify(patchesGroups?.['get-microsoft-task'], "ids.notionId") || []
        const editMicrosoftChecklistItem = patchesGroups?.['edit-microsoft-checklistItem'] || []
        const deleteMicrosoftTask = patchesGroups?.['delete-microsoft-task'] || []

        await this.changeViaBatch(
            TodoManager._createMSBatchRequestContents(
                editMicrosoftChecklistItem,
                ({operation, type, ids: {notionId, parentNotionId, microsoftId, parentMicrosoftId}, data}) =>
                    this._batchStepCreators?.[operation]?.[type]?.(
                        {
                            id: TodoManager._createBatchRequestId(parentNotionId, notionId),
                            microsoftId,
                            parentMicrosoftId,
                            ...data
                        }
                    )
            )
        )

        notionPatchesGroups.toEdit.push(
            ...editNotionTask.map(
                ({ids, data, syncData}) => ({ids, data, syncData})
            ).concat(
                Action.connect(
                    editNotionTaskBending,
                    await this.changeViaBatch(
                        TodoManager._createMSBatchRequestContents(
                            editMicrosoftTask,
                            ({operation, type, ids: {notionId, microsoftId}, data}) =>
                                this._batchStepCreators?.[operation]?.[type]?.(
                                    {
                                        id: notionId,
                                        microsoftId,
                                        ...data
                                    }
                                )
                        ),
                        null,
                        false
                    ),
                    "ids.notionId",
                    "id",
                    "flat"
                ).map(
                    ([, {ids, data}, {body: microsoftData}]) => (
                        {
                            ids,
                            data,
                            syncData: {
                                microsoftData: microsoftData
                            }
                        }
                    )
                )
            )
        )

        notionPatchesGroups.toCreate.push(
            ...createNotionTask.map(
                ({ids, data, syncData}) => ({ids, data, syncData})
            ).concat(
                Action.connect(
                    createNotionTaskBending,
                    await this.changeViaBatch(
                        TodoManager._createMSBatchRequestContents(
                            createMicrosoftTask,
                            ({operation, type, ids: {microsoftId}, data}) =>
                                this._batchStepCreators?.[operation]?.[type]?.(
                                    {
                                        id: microsoftId,
                                        ...data
                                    }
                                )
                        ),
                        null,
                        false
                    ),
                    "ids.microsoftId",
                    "id",
                    "flat"
                ).map(
                    ([, {ids, data}, {body: microsoftData}]) => (
                        {
                            ids,
                            data,
                            syncData: {
                                microsoftData: microsoftData
                            }
                        }
                    )
                )
            )
        )

        await this.changeViaBatch(
            TodoManager._createMSBatchRequestContents(
                deleteMicrosoftTask,
                ({operation, type, ids: {notionId, microsoftId}}) =>
                    this._batchStepCreators?.[operation]?.[type]?.(
                        {
                            id: notionId,
                            microsoftId
                        }
                    )
            ),
            null,
            false
        )

        notionPatchesGroups.toDelete.push(
            ...deleteNotionTask.map(
                ({ids}) => (
                    {
                        ids
                    }
                )
            )
        )

        notionPatchesGroups.toRefresh.push(
            ...(
                await this.changeViaBatch(
                    TodoManager._createMSBatchRequestContents(
                        getMicrosoftTask,
                        ({operation, type, ids: {notionId, microsoftId}, data}) =>
                            this._batchStepCreators?.[operation]?.[type]?.(
                                {
                                    id: notionId,
                                    microsoftId,
                                    ...data
                                }
                            )
                    ),
                    getMicrosoftTask,
                    false,
                    ["id", "ids.notionId"]
                )
            ).map(
                ({body: microsoftData, extension: {ids}}) => (
                    {
                        ids,
                        syncData: {
                            microsoftData: microsoftData
                        }
                    }
                )
            )
        )

        if (cd.length) {
            await this._setCheckpointDate()
        }

        return notionPatchesGroups
    }
}

class TodoManager extends TodoManagerBase {
    constructor(props) {
        super(props);
        this.asAddedTasks = new TodoManagerNewTasksHandler(props)
        this.asEditedTasks = new TodoManagerEditedTasksHandler(props)
        this.tasksDelta = new TodoManagerTasksDetector(props)
    }

    static _getDateFromMSDateTimeTimeZone = ({dateTime, timeZone}={}) => {
        try {
            return moment(dateTime).tz(timeZone)
        } catch (e) {
            return null
        }
    }

    static _createMSDateTimeTimeZone = (date, timeZone) => {
        try {
            const dateTime = moment(date).utc().tz(timeZone)
            const dataTimeString = dateTime.format("YYYY-MM-DDTHH:mm:ss.SSSSSSS")
            return {
                dateTime: dataTimeString,
                timeZone
            }
        } catch (e) {
            return null
        }
    }

    static _createMSInputsList = (notionTasksList, timeZone) =>
        Array.from(notionTasksList).map(
            (
                {
                    id,
                    icon: {emoji} = {},
                    properties: {
                        "الاسم": {
                            title: [
                                {
                                    text: {content: title} = {},
                                },
                            ] = [{}],
                        } = {},
                        "التاريخ": {
                            date: {start, end} = {},
                        } = {},
                        "تم": {checkbox: checked} = {},
                        "التفصيلات": {relation: children = []} = {},
                        "تفصيلة لـ": {relation: parents = []} = {},
                    } = {},
                    archived: deleted,
                    editedParentNotionIds
                } = {}
            ) => (
                {
                    notionId: id,
                    ...((emoji !== undefined || title !== undefined) ? {title: [emoji, title].filter(Boolean).join(" ")} : {}),
                    ...(checked !== undefined ? {status: checked ? 'completed' : 'notStarted'} : {}),
                    ...((start !== undefined && timeZone !== undefined) ? {
                        reminderDateTime: TodoManager._createMSDateTimeTimeZone(start, timeZone),
                        startDateTime: TodoManager._createMSDateTimeTimeZone(start, timeZone)
                    } : {}),
                    ...(((end !== undefined || start !== undefined) && timeZone !== undefined) ? {
                        dueDateTime: end
                            ? TodoManager._createMSDateTimeTimeZone(end, timeZone)
                            : TodoManager._createMSDateTimeTimeZone(start, timeZone)
                    } : {}),
                    childrenNotionIds: children.map(({id}) => id),
                    parentNotionIds: parents.map(({id}) => id),
                    ...(editedParentNotionIds ? {editedParentNotionIds} : {}),
                    ...(checked !== undefined ? {checked} : {}),
                    ...(deleted !== undefined ? {deleted} : {}),
                }
            )
        )

    static _createMSInputsMap = (msInputsList) => new Map(
        msInputsList.map(
            ({notionId, ...data}) => [
                notionId,
                {
                    notionId,
                    ...data
                }
            ]
        )
    )

    static _createMSBatchRequestContents = function* (
        array,
        mapCallback,
        hasDependencies = true
    ) {
        for (const subArray of _.chunk(array, TodoManager.STEPS_LIMIT_PER_BATCH)) {
            const msBatchRequestContent = new BatchRequestContent()
            const stepIds = []

            msBatchRequestContent.addRequest(
                createMeBatchStep(TodoManager.INITIAL_STEP_ID)
            )

            subArray?.forEach(
                (item) => {
                    const step = mapCallback(item)
                    const {id} = step

                    if (stepIds.includes(id)) {
                        msBatchRequestContent.removeRequest(
                            id
                        )
                    } else {
                        stepIds.push(id)
                    }

                    msBatchRequestContent.addRequest(
                        step
                    )

                }
            )

            if (hasDependencies) {
                for (const [previousId, currentId] of tandemIter([TodoManager.INITIAL_STEP_ID].concat(stepIds))) {
                    if (previousId) {
                        // msBatchRequestContent.addDependency(currentId, previousId)
                        msBatchRequestContent.addDependency(currentId, "<initial-step>")
                    }
                }
            }

            yield msBatchRequestContent
        }
    }

    static _createBatchRequestId = (...args) => args.join("::::")

    static _covertTodoTaskTitleToObject = (title) => {
        const regex = /(?<emoji1>\p{Emoji})\s*(?<title1>.+)\s*|(?<title2>.+)\s(?<emoji2>\p{Emoji})|(?<emoji3>\p{Emoji})\s*|(?<title3>.+)\s*/gu;

        const match = regex.exec(title);

        if (match) {
            const {emoji1, emoji2, emoji3, title1, title2, title3} = match.groups

            return {
                emoji: emoji1 || emoji2 || emoji3 || "",
                title: title1 || title2 || title3 || "",
            }
        } else return {}

    }

    static _diffNotionTasksInCD = function* (connectedDataset) {
        for (const [id, [current, [{fields: {notionData: pastAsJSON}}]]] of connectedDataset) {
            const past = JSON.parse(pastAsJSON)

            const difference = detailedDiff(
                past,
                current
            )

            const [pastParents, restParents, newParents] = diff(
                past?.properties?.["تفصيلة لـ"]?.relation,
                current?.properties?.["تفصيلة لـ"]?.relation,
            )

            const updates = _.pick(
                difference.updated,
                [
                    "icon.emoji",
                    "properties.الاسم.title.0.text.content",
                    "properties.التاريخ.date",
                    "properties.تم.checkbox",
                    "archived",
                ]
            )

            const notionTask = Object.keys(
                _.pick(
                    updates,
                    [
                        "icon.emoji",
                        "properties.الاسم.title.0.text.content",
                    ]
                )
            ).length ?
                _.merge(
                    _.pick(
                        current,
                        [
                            "icon.emoji",
                            "properties.الاسم.title.0.text.content",
                            "properties.التفصيلات.relation"
                        ]
                    ),
                    updates
                ) :
                _.merge(
                    _.pick(
                        current,
                        [
                            "properties.التفصيلات.relation"
                        ]
                    ),
                    updates
                )


            if (
                Object.keys(updates).length ||
                pastParents.length ||
                newParents.length
            ) {
                yield {
                    id,
                    ...notionTask,
                    editedParentNotionIds: {
                        pastParentNotionIds: pastParents.map(({id}) => id),
                        restParentNotionIds: restParents.map(({id}) => id),
                        newParentNotionIds: newParents.map(({id}) => id)
                    }
                }
            }

        }
    }

    static _diffTodoTasksInCD = function* (connectedDataset) {
        for (const [, current, {
            id: airtableId,
            fields: {notionId, microsoftId, microsoftData: pastAsJSON}
        }] of connectedDataset) {
            const past = JSON.parse(pastAsJSON)

            const difference = updatedDiff(
                past,
                current
            )

            const [pastChecklistItems, restChecklistItems, newChecklistItems, editedChecklistItems] = diff(
                past?.checklistItems,
                current?.checklistItems,
                "id"
            )

            const updates = _.merge(
                _.pick(
                    difference,
                    [
                        "status",
                        "title",
                        "startDateTime",
                        "dueDateTime",
                    ]
                ),
                difference?.title ? {detailedTitle: TodoManager._covertTodoTaskTitleToObject(difference?.title)} : {}
            )

            if (
                !_.isEmpty(updates) ||
                pastChecklistItems?.length ||
                restChecklistItems?.length ||
                newChecklistItems?.length ||
                editedChecklistItems?.length
            )

                yield {
                    microsoftId,
                    notionId,
                    airtableId,
                    updatedProps: updates,
                    pastProps: _.pick(
                        past,
                        [
                            "status",
                            "title",
                            "startDateTime",
                            "dueDateTime"
                        ]
                    ),
                    updatedChecklistItems: {
                        past: pastChecklistItems,
                        rest: restChecklistItems,
                        new: newChecklistItems,
                        edited: editedChecklistItems
                    },
                    microsoftData: current,
                }

        }
    }

    static _prepareTodoTasksInUCD = function* (unconnectedDataset) {
        for (const microsoftData of unconnectedDataset) {
            const {id: microsoftId} = microsoftData

            const updates = _.merge(
                _.pick(
                    microsoftData,
                    [
                        "status",
                        "title",
                        "startDateTime",
                        "dueDateTime",
                        "checklistItems"
                    ]
                ),
                microsoftData?.title ? {detailedTitle: TodoManager._covertTodoTaskTitleToObject(microsoftData?.title)} : {}
            )

            yield {
                microsoftId,
                props: updates,
                microsoftData
            }
        }
    }

    static INITIAL_STEP_ID = "<initial-step>"

    static STEPS_LIMIT_PER_BATCH = 19
}

exports.TodoManager = TodoManager