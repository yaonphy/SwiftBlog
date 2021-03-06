var _ = require('lodash');
var kramed = require('kramed');


// Utility function for splitting a list into groups
function splitBy(list, starter, ender) {
    var starts = 0;
    var ends = 0;
    var group = [];

    // Groups
    return _.reduce(list, function(groups, value) {
        // Ignore start and end delimiters in resulted groups
        if(starter(value)) {
            starts++;
        } else if(ender(value)) {
            ends++;
        }

        // Add current value to group
        group.push(value);

        // We've got a matching
        if(starts === ends && starts !== 0) {
            // Add group to end groups
            // (remove starter and ender token)
            groups.push(group.slice(1, -1));

            // Reset group
            group = [];
        }

        return groups;
    }, []);
}

function listSplit(nodes, start_type, end_type) {
    return splitBy(nodes, function(el) {
        return el.type === start_type;
    }, function(el) {
        return el.type === end_type;
    });
}

// Get the biggest list
// out of a list of kramed nodes
function filterList(nodes) {
    return _.chain(nodes)
    .toArray()
    .rest(function(el) {
        // Get everything after list_start
        return el.type !== 'list_start';
    })
    .reverse()
    .rest(function(el) {
        // Get everything after list_end (remember we're reversed)
        return el.type !== 'list_end';
    })
    .reverse()
    .value().slice(1, -1);
}

function skipSpace(nodes) {
    return _.filter(nodes, function(node) {
        return node && node.type != 'space';
    });
}

function correctLoose(nodes) {
    return _.map(nodes, function(node) {
        // Return normal nodes
        if(!node || node.type != 'loose_item_start') {
            return node
        }

        // Correct loose items
        node.type = 'list_item_start';

        return node;
    })
}

// Parses an Article or Chapter title
// supports extracting links
function parseTitle(src, nums) {
    // Check if it's a link
    var matches = kramed.InlineLexer.rules.link.exec(src);

    var level = nums.join('.');

    // Not a link, return plain text
    if(!matches) {
        return {
            title: src,
            level: level,
            path: null,
        };
    }

    return {
        title: matches[1],
        level: level,

        // Normalize path
        // 1. Convert Window's "\" to "/"
        // 2. Remove leading "/" if exists
        path: matches[2].replace(/\\/g, '/').replace(/^\/+/, ''),
    };
}

function parseChapter(nodes, nums) {
    // Convert single number to an array
    nums = _.isArray(nums) ? nums : [nums];

    return _.extend(parseTitle(_.first(nodes).text, nums), {
        articles: _.map(listSplit(filterList(nodes), 'list_item_start', 'list_item_end'), function(nodes, i) {
            return parseChapter(nodes, nums.concat(i + 1));
        })
    });
}

function defaultChapterList(chapterList) {
    var first = _.first(chapterList);

    // Check if introduction node was specified in SUMMARY.md
    if (first) {
        var chapter = parseChapter(first, [0]);

        // Already have README node, we're good to go
        if(chapter.path === 'README.md') {
            return chapterList;
        }
    }

    // It wasn't specified, so add in default
    return [
        [ { type: 'text', text: '[Introduction](README.md)' } ]
    ].concat(chapterList);
}

function listGroups(src) {
    var nodes = kramed.lexer(src);

    // Get out groups of lists
    return listSplit(
        filterList(correctLoose(skipSpace(nodes))),
        'list_item_start', 'list_item_end'
    );
}

function parseSummary(src) {
    // Split out chapter sections
    var chapters = defaultChapterList(listGroups(src));

    return {
        chapters: chapters.map(parseChapter)
    };
}

function parseEntries (src) {
    return listGroups(src).map(parseChapter);
}


// Exports
module.exports = parseSummary;
module.exports.entries = parseEntries;
