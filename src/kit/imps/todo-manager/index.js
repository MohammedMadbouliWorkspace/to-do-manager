const {asyncIter2Array, sleep} = require("../../utils/async");
const {BatchRequestContent} = require("@microsoft/microsoft-graph-client");
const {Action} = require("../../foundations/bulk");
const _ = require('lodash');
const {tandemIter, diff, uniquify} = require("../../utils/iter");
const {createMeBatchStep} = require("../../../microsoft/clients/graph/tools");
const {Airtable} = require("../../foundations/airtable");
const {Todo} = require("../../foundations/microsoft/todo");
const createGraphClient = require("../../../microsoft/clients/graph");
const {detailedDiff} = require("deep-object-diff");

class TodoManagerBase {
    constructor(
        {
            z,
            msAccessToken,
            airtableConfig: {
                apiKey: airtableAPIKey,
                baseId: airtableBaseId,
                idsTableId: airtableIdsTableId,
                dataTableId: airtableDataTableId
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

    changeViaBatch = async (msBatchRequestContentsGenerator, extension = null, returnAsEntries = true) => {
        let fullRes = []

        for(const msBatchRequestContent of msBatchRequestContentsGenerator) {
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
                "id",
                "id",
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

class TodoManagerDetector extends TodoManagerBase {
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

class TodoManagerEditedTasksDetector extends TodoManagerDetector {
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
            const subEditedTaskDetector = new TodoManagerEditedTasksDetector(this._props, true)
            subEditedTaskDetector.provide(subNotionTasksList)
            yield* subEditedTaskDetector.msInputs()
        }

    }
}

class TodoManagerNewTasksDetector extends TodoManagerDetector {
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

class TodoManager extends TodoManagerBase {
    constructor(props) {
        super(props);
        this.asAddedTasks = new TodoManagerNewTasksDetector(props)
        this.asEditedTasks = new TodoManagerEditedTasksDetector(props)
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
            ) => {
                const startDateTime = start?.replace(/([+-]\d\d:\d\d)$/, ''),
                    dueDateTime = end?.replace(/([+-]\d\d:\d\d)$/, '')

                return {
                    notionId: id,
                    ...((emoji !== undefined || title !== undefined) ? {title: [emoji, title].filter(Boolean).join(" ")} : {}),
                    ...(checked !== undefined ? {status: checked ? 'completed' : 'notStarted'} : {}),
                    ...((startDateTime !== undefined && timeZone !== undefined) ? {
                        reminderDateTime: {
                            dateTime: startDateTime,
                            timeZone: timeZone,
                        },
                        startDateTime: {
                            dateTime: startDateTime,
                            timeZone: timeZone,
                        },
                    } : {}),
                    ...(((dueDateTime !== undefined || startDateTime !== undefined) && timeZone !== undefined) ? {
                        dueDateTime: dueDateTime
                            ? {
                                dateTime: dueDateTime,
                                timeZone: timeZone,
                            }
                            : {
                                dateTime: startDateTime,
                                timeZone: timeZone,
                            }
                    } : {}),
                    childrenNotionIds: children.map(({id}) => id),
                    parentNotionIds: parents.map(({id}) => id),
                    ...(editedParentNotionIds ? {editedParentNotionIds} : {}),
                    ...(checked !== undefined ? {checked} : {}),
                    ...(deleted !== undefined ? {deleted} : {}),
                }
            }
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
        for(const subArray of _.chunk(array, TodoManager.STEPS_LIMIT_PER_BATCH)) {
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

    static INITIAL_STEP_ID = "<initial-step>"

    static STEPS_LIMIT_PER_BATCH = 19
}

exports.TodoManager = TodoManager