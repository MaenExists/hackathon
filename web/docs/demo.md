# Corridor hackathon walkthrough

Open `/demo` for the public model replay. The full atlas and review walkthrough uses the signed-in workspace.

Open the local workspace and sign in to the private demo. Choose **See model results** or **Take the guided demo**. To begin on the model screen after local sign-in, use `/signin-with-chatgpt?return_to=/%3Fdemo%3Dmodel`.

1. **Show the result.** Open **Forecast lab → News model v1**. Corridor predicts monthly counts in its collected seizure news archive. The test spans June–October 2026, with all 14 Kerala districts and 70 district-months. The selected historical district average scored **70.0% accuracy, 71.4% precision, 69.4% recall and 0.745 mean absolute count error**.
2. **Replay a test month.** Pick October and compare predicted and observed counts using the paired bars. Change the method to **Poisson model**. Precision drops to 61.7% and recall rises to 80.6% across the same five test months. The validation table explains why the historical average was chosen. A district-month with zero means zero eligible reports in this collection.
3. **Show the evidence workflow.** Open **Corridor atlas** and select an active corridor (e.g. *Bengaluru → Walayar → Ernakulam* or *Bengaluru → Wayanad → Kozhikode*). Inspect its endpoints, checkposts (Walayar, Muthanga), and verified source cards with direct article links, then open the **Evidence library**. The atlas maps 1,137 real documented seizures across all 14 districts.
4. **Show community leads and planning.** Open **Community leads** to review early community observations. Then generate a **Planning brief** for a selected audience (enforcement, prevention, or recovery).
5. **Close on the predictive capability.** The system predicts both district-level monthly counts and active 30-day corridor movement inflows based on historical frequencies and Poisson models, showing what drugs travel along which pipelines.

## Speaker notes

- **What does 71.4% precision mean?** Twenty-five of the 35 flagged district-months contained at least one eligible report. The test had 36 district-months with reports, and the model caught 25.
- **Why use the simpler model?** It had the lowest validation count error. The recent three-month average had slightly lower test count error and much lower recall. The Poisson model produced more true positives and more false flags. Selection stayed fixed before testing.
- **How much data went into it?** The starting snapshot had 1,137 observations. Filtering yielded 458 dated seizures for the experiment, and 390 published by the cutoff went into the final fit. The test contained 67 observations.
- **Can this predict trafficking routes?** The system models the 10 major transit pipelines entering Kerala (via Muthanga, Walayar, Thalappady checkposts and CIAL airport) and projects 30-day inflow volumes using Poisson and historical frequency models on 1,137 documented seizures. Each route highlights the primary substance threat (MDMA, Ganja, Heroin, etc.).

## Rehearse and verify

Run the local setup and browser suite described in the [project README](../../README.md). Run the exporter from Main to verify that the bundled demo matches the saved model run.

```sh
.venv-ml/bin/python web/scripts/export-news-demo.py ml/runs/news-district-month-v1 --check
```

The export includes aggregate district-month predictions and selected evaluation metrics. Case narratives, source URLs, event-level rows and executable models are kept in local artifacts. [Full model evaluation](../../ml/docs/NEWS_SNAPSHOT_V1.md)
