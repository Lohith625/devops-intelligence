require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = 5000;


app.get('/', (req, res) => {
  res.send('DevOps Intelligence Backend Running');
});


app.get('/runs', async (req, res) => {
  try {
    const owner = req.query.owner;
    const repo = req.query.repo;

    if (!owner || !repo) {
      return res.status(400).send('Owner and repo required');
    }

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        },
      }
    );

    const runs = response.data.workflow_runs;

    let detailedRuns = [];


    for (let run of runs.slice(0, 5)) {
      const jobsRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/jobs`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          },
        }
      );

      const jobs = jobsRes.data.jobs.map(job => ({
        name: job.name,
        status: job.conclusion,
        steps: job.steps.map(step => ({
          name: step.name,
          status: step.conclusion,
        })),
      }));

      detailedRuns.push({
        id: run.id,
        status: run.conclusion,
        jobs,
      });
    }



    const stepAnalysis = analyzeSteps(detailedRuns);
    const smartSuggestions = generateStepSuggestions(stepAnalysis);

    const totalRuns = detailedRuns.length;
    const failedRuns = detailedRuns.filter(r => r.status === 'failure').length;

    const stats = {
      totalRuns,
      failedRuns,
      successRuns: totalRuns - failedRuns,
      failureRate: ((failedRuns / totalRuns) * 100).toFixed(2),
    };

 
    res.json({
      detailedRuns,
      stepAnalysis,
      smartSuggestions,
      stats,
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).send('Error fetching detailed runs');
  }
});


function analyzeSteps(detailedRuns) {
  let failingSteps = {};

  detailedRuns.forEach(run => {
    run.jobs.forEach(job => {
      job.steps.forEach(step => {
        if (step.status === 'failure') {
          failingSteps[step.name] =
            (failingSteps[step.name] || 0) + 1;
        }
      });
    });
  });

  return failingSteps;
}


function generateStepSuggestions(stepAnalysis) {
  let suggestions = [];

  Object.keys(stepAnalysis).forEach(step => {

    if (step.toLowerCase().includes('push')) {
      suggestions.push(
        'Check GitHub token permissions (write access required)',
        'Verify branch protection rules',
        'Ensure correct remote repository URL'
      );
    }

    if (step.toLowerCase().includes('install')) {
      suggestions.push(
        'Check dependency versions',
        'Use caching to speed up installs',
        'Verify package.json / requirements.txt'
      );
    }

    if (step.toLowerCase().includes('test')) {
      suggestions.push(
        'Fix failing test cases',
        'Add retries for flaky tests'
      );
    }

  });

  return suggestions;
}


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});