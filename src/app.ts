import {
  BlockLocation,
  CraftBlock,
  CraftBlockUpdate,
  CraftTextBlock,
  CraftTextRun,
  IndexLocation,
} from "@craftdocs/craft-extension-api";

// ptr feed types will be open sourced and importable soon
type FeedItem = {
  id: string;
  date_published: string;
  url: string;
  content_text: string;
  _ptr_sender_type: string;
};

// dark/light mode, see https://tailwindcss.com/docs/dark-mode#toggling-dark-mode-manually
function initColorSchemeHandler() {
  craft.env.setListener((env) => {
    if (env.colorScheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  });
}

function renderMessages(messages: FeedItem[]) {
  const articlesDiv = document.getElementById("articles");
  articlesDiv.innerHTML = "";

  if (messages && messages.length > 0) {
    messages.forEach((feedItem: FeedItem) => {
      const htmlToInsert: Node = createHTMLForFeedItem(feedItem);
      articlesDiv.appendChild(htmlToInsert);
    });
  }
}

function createHTMLForFeedItem(feedItem: FeedItem): Node {
  const htmlString: string = `
  <div class="gridItem" data-ptr-text="${`${feedItem.content_text}`}" data-ptr-id="${`${feedItem.id}`}">
    <div class="text-sm font-medium select-none" id="text">
      ${feedItem?.content_text?.substring(0, 200)}
    </div>
  </div>`;
  return new DOMParser().parseFromString(htmlString, "text/html").body
    .childNodes[0];
}

function updateMessage(messageId, newStatus) {
  fetch(
    `https://app.phonetonote.com/feed/${messageId}.json?roam_key=${
      (document.getElementById("ptr-roam-key") as HTMLInputElement).value
    }`,
    {
      method: "PATCH",
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        status: newStatus,
      }),
    }
  ).then((res) => res.json());
}

type ErrorMessage = {
  message: string;
};

async function loadMessages(): Promise<[FeedItem[], ErrorMessage]> {
  let items = [];
  let error = {} as ErrorMessage;

  try {
    const data = await fetch(
      `https://app.phonetonote.com/feed.json?roam_key=${
        (document.getElementById("ptr-roam-key") as HTMLInputElement).value
      }`
    ).then((res) => res.json());

    if (data.error) {
      error.message = data.error;
    }

    items = data.items;
  } catch (err) {
    error.message = err.message;
  } finally {
    return [items, error];
  }
}

async function loadAndRenderMessages(showAlert) {
  const [loadedMessages, errorMessage] = await loadMessages();

  if (errorMessage.message) {
    alert(errorMessage.message);
  } else {
    renderMessages(loadedMessages);
  }

  renderMessages(loadedMessages);
  document.getElementById("spinner").style.visibility = "hidden";
  document.getElementById("spinner").style.display = "none";

  if (loadedMessages.length > 0) {
    document.getElementById("footer").style.display = "block";
  } else if (showAlert && !errorMessage.message) {
    alert("no messages found");
  }
}

function initButtonHandler() {
  document.getElementById("insert_button").onclick = async () => {
    const items = [];
    const articles = [].slice.call(
      document.getElementById("articles").children
    );
    for (var i = 0; i < articles.length; i++) {
      const element = articles[i];
      updateMessage(element?.dataset?.ptrId, "syncing");

      const content: CraftTextRun[] = [
        { text: element?.dataset?.ptrText, isBold: true },
      ];

      const branchBlock = craft.blockFactory.textBlock({
        content,
        listStyle: { type: "numbered" },
      });
      items.push(branchBlock);
    }

    await craft.dataApi.addBlocks(items).then(() => {
      // not great to have to reiterate over these, could try to redo this to add the blocks one at a time
      // so we could mark them as published in the same go
      for (var i = 0; i < articles.length; i++) {
        const element = articles[i];
        updateMessage(element?.dataset?.ptrId, "synced");
      }

      loadAndRenderMessages(false);
    });
  };

  document.getElementById("enter-ptr-roam-key").onsubmit = async (e) => {
    e.preventDefault();
    loadAndRenderMessages(true);
  };
}

export function initApp() {
  initColorSchemeHandler();
  initButtonHandler();
  document.getElementById("spinner").style.visibility = "hidden";
  document.getElementById("spinner").style.display = "none";
}
