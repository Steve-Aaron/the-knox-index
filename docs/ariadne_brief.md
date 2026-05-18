# **Project Ariadne**

Ariadne is the database-with-website that collects the TikTok content produced every day by political figures in the UK and across the world, and presents this in an easily-digestible and useful format to politically interested stakeholders.

This project requirements list is split in three ways:

* Backend, which is an n8n workflow.  
* Frontend Web, which relies on a ReactNative (using Expo) site, which has a componentized way to present the information we have on TikTok findings.  
* Email, which is about sending daily updates to all recipients about project Ariadne findings.

The below contains the overall project goals, and then specific requirements for each element of the project before we can determine v1 is a success.

## Key audiences:

We want our product to appeal to the following audiences:

* Political Communications Consultancies

*For example: Portland, Hanbury, Milltown Partners.*

As a political consultant, I can use Project Ariadne to understand which major political figures are and are not on TikTok. What they are posting, why, and what common themes they have this week.

As a political consultant, I can also see what is being spoken about *this week* on TikTok by my target audience. I can see how this compares to news stories of the week, and who is doing well today, this week, or this month.

As a consultant, I get a fun email each morning with information and insight from Knox that tells me stuff my colleagues don’t know.

As a political consultant, I can export the data to send it on to a client. I can pay to have it white labelled, so I can send it on and go “*ooh look at me I am doing all this wonderful research aren’t I so clever*” to a client.

| *They should say…* “You need to take a look at this, it’s really interesting that Farage is doing this type of content recently because…” |
| ----- |

* Digital Agencies interested in what political figures do.

*For example: Wolf Olins, Founders Makers.*

As a Digital Agency, I want to see what political campaigners are doing when it comes to TikTok, so I know what people working in the ‘dark arts’ are talking about.

As a Digital Agency, I want to look at the type of content MPs I care about are posting, and see how they are doing compared to other MPs.

| *They should say…* “God, did Chris Curtis MP really do a “Wake up with me” video?” |
| ----- |

* ### Caseworkers and Senior Parliamentary Officers

As a Caseworker, I need to know what issues constituents are raising online, especially on platforms like TikTok, so I can better prepare the MP for debates or responses to local concerns.

As a Senior Parliamentary Officer, I want to quickly see if the MP's recent social media posts are resonating with the public or if they are causing any unintended negative reactions, allowing us to pivot quickly.

As a Senior Parliamentary Officer, I want to know how my MP is doing compared to the opposition near me, and what other MPs in my region of the country are talking about.

| \*They should say…\*  "I need to flag this specific TikTok video to the MP's comms team \- the Diego Garcia conversation is getting a lot of traction from their opposition." |
| :---- |

## 

* ### MPs, Councillors, MSPs, etc.

As an MP, I want a daily briefing that tells me what my political opponents are doing on TikTok, focusing on content style and themes, so I can identify successful strategies or avoid their mistakes.

As a Councillor, I want to see which local issues are trending on TikTok among younger constituents and what type of content (e.g., informative vs. humorous) is gaining the most traction on those issues.

| They should say…"The data shows that short, punchy videos about local transport are performing best—we need to pivot our communications strategy to match." |
| :---- |

## 

* ### Journalists & Tech Journalists interested in political affairs

As a Political Journalist, I can use Project Ariadne to find unique stories about political figures and their digital strategy—specifically, which figures are using TikTok effectively and which are falling behind.

As a Tech Journalist, I want to see how TikTok’s being used in politics and use the data to analyze how different political content is being prioritized on the platform.

| They should say… “Wow, Ealing Council is absolutely dominating this week on TikTok – hang on, they’re making videos about *what…*." |
| :---- |

---

# Project requirements

## Backend:

- [ ] Ariadne runs on a daily basis.  
- [ ] Ariadne takes less than 30 minutes to complete.

### Data sources

- [ ] Ariadne stores all TikToks in the past 24 hours from all MPs in the UK.  
- [ ] Ariadne stores all TikToks in the past 24 hours from all party heads in the UK.  
- [ ] Ariadne stores all TikToks in the past 24 hours around all UK councils on social media.  
- [ ] Ariadne stores all TikToks in the past 24 hours from at least one political leader in the following countries:  
      - [ ] UK  
      - [ ] France  
      - [ ] Italy  
      - [ ] Germany  
      - [ ] USA  
      - [ ] Australia  
      - [ ] New Zealand  
      - [ ] Netherlands  
      - [ ] Hungary

### Data ingestion

- [ ] n8n puts TikTok post data on the Ariadne database.  
- [ ] n8n puts TikTok account and account metric data on the Ariadne database.  
- [ ] N8n puts TikTok style data on the Ariadne database.  It can be parsed within max 20 categories.  
- [ ] n8n puts TikTok topic data on the Ariadne database. It can be easily parsed, within max 20 categories.  
- [ ] n8n assigns Parties and political affiliations to each account  
- [ ] n8n gives us video summaries for all posts that go into the database.

### Data Runs

- [ ] n8n automatically runs at 5am every day  
- [ ] n8n can be ran manually to run a new page to follow each day.

### Data Exports

- [ ] A user can export CSV data with postIds, post summaries, and all details *except* the videoUrls and Jpegs, in the past 24 hours.

## Frontend:

**By using the dashboard, I can find out:**

- [ ] Which Party is doing best on TikTok?  
- [ ] Which Party is most active on TikTok?  
- [ ] Which MPs are leading the way in their political Party?  
      - [ ] ‘Top Trump’ view on the dashboard, to see where politicians are:  
            - [ ] This Week  
            - [ ] This Month  
            - [ ] This Year  
            - [ ] Lifetime  
      - [ ] View ‘per politician’: look up a politicians’ performance, which includes:  
            - [ ] A radial chart which maps out their score on five points:  
                  - [ ] Post frequency  
                  - [ ] Post virality  
                  - [ ] Like rate  
                  - [ ] Comment \+ share rate  
                  - [ ] “Knox Factor” score (TBD)  
- [ ] What content would be the ones that would go viral?  
- [ ] Which Councils on TikTok?  
- [ ] How well are these MPs doing versus other MPs?  
- [ ] What are people TikTokking about this year?  
- [ ] What TikToks were popular yesterday?  
- [ ] What TikToks went viral yesterday?  
- [ ] What style of TikToks do MPs make?  
- [ ] How does ‘this MP’ perform on TikTok? How engaged are their followers?  
- [ ] Has this MP bought followers (abroad)?  
- [ ] What subjects are being talked about?  
- [ ] Who’s gone silent?  
- [ ] How to get in touch for more bespoke information.

**By using the dashboard, my LinkedIn news headline or press headline?**

- [ ] “This MP has done the best on TikTok this week – here’s why…”  
- [ ] “How TikTok-obsessed is your Member of Parliament?”  
- [ ] “How TikTok-obsessed is your Member of Parliament?”  
- [ ] "These six MPs have made more TikToks this month than appearances in Parliament"  
- [ ] "Why are Parliament speeches being TikTokified..."  
- [ ] "Dr Luke Evans is a silent hit on TikTok \- but here's what he's been posting."

**Behind a paywall or option, we put…**

- [ ] Other countries’ data  
- [ ] White label data exports  
- [ ] Options to download video files and cover images  
- [ ] Options to download data over a longer period of time

Visible information on the dashboard, at the very least, should include:

*Build a dashboard page using the information you can gather. Make sure we can see the following per page:*

- [ ] Account Name  
- [ ] Associated party (if any)  
- [ ] Associated political view (if any)  
- [ ] Total posts  
- [ ] Total page followers  
- [ ] Total page likes  
- [ ] Total page views in past 24 hours

And the below per post:

- [ ] Total views  
- [ ] Total likes  
- [ ] Video summary  
- [ ] Engagement rate (Video reactions divided by video views)  
- [ ] Total comments  
- [ ] Total shares  
- [ ] Caption  
- [ ] Link

And we have filters for the following:

- [ ] Account Name  
- [ ] Party  
- [ ] Political view  
- [ ] Minimum views  
- [ ] Minimum likes

Add a ‘sort by’ option as well, to sort by total views, or total likes.

### Email Component

**By using the email, I should be able to find out:**

- [ ] How many TikToks came out from MPs today?  
- [ ] What were the most seen videos?  
- [ ] Which videos went viral, relative to their audience?  
- [ ] What are people, in general, saying on TikTok?  
- [ ] What are the top narratives on TikTok?  
      - [ ] How many people saw them?  
      - [ ] What sorts of videos were they?  
      - [ ] Are they part of a wider narrative of content that has been posted on TikTok?