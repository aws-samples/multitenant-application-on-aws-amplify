Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 
CodeCommit: 

# git-remote-codecommit Setup: 

- Guides: 

[UserGuide](https://docs.amazonaws.cn/en_us/codecommit/latest/userguide/setting-up-git-remote-codecommit.html) 

[Setup steps for HTTPS connections to Amazon CodeCommit repositories on Linux, OS X, or Unix with the Amazon CLI credential helper](https://docs.amazonaws.cn/en_us/codecommit/latest/userguide/setting-up-https-unixes.html)

[Setup steps for HTTPS connections to Amazon CodeCommit repositories on Windows with the Amazon CLI credential helper](https://docs.amazonaws.cn/en_us/codecommit/latest/userguide/setting-up-https-windows.html)

## Step 1: Confirm Pip Installed 
    - pip --version

## Step 2: Install git-remote-codecommit
    - pip install --user git-remote-codecommit
    - git config --global credential.helper "!aws codecommit credential-helper $@"
    - git config --global credential.UseHttpPath true
```
confirm output in the .gitconfig file within the user profile folder: 
            The Git credential helper writes the following to the .gitconfig file:
                [credential]    
                helper = !aws codecommit credential-helper $@ 
                UseHttpPath = true 
```

## Step 3: Connect to the CodeCommit console 

- Examples: 

    - Using Default profile for repo in us-east-2: 
        - git remote add codecommit codecommit::us-east-1://CodeCommitRepoName

    - Using Named AWS CLI Profile in us-east-1: 
        - git remote add codecommit codecommit::us-east-2://awscliprofile@CodeCommitRepoName

    - Undo incase of error: 
        - git remote rm codecommit 

## Step 4: Push local repo to code commit: 

    - Chose Either option below to push commit to remote codecommit repo 
        - git push —set-upstream codecommit main
        - git push -u codecommit main 




